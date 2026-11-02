// Compiles styles/**/*.scss into static/css/**/*.css.
//
// - Files starting with "_" are partials (tokens, tools) and are pulled in
//   via @use, never compiled on their own.
// - Output paths mirror the source tree: styles/pages/post.scss ->
//   static/css/pages/post.css, which is the layout the Go builder's
//   cssFiles list (internal/builder/builder.go) expects.
// - The Go side minifies the bundle itself, so we compile expanded to keep
//   the intermediate files readable and reviewable.
//
// Usage: npm run styles  (or: node scripts/build-styles.mjs [--check])
// --check compiles without writing and fails if any output would change,
// so CI / prepack can verify the committed CSS is up to date.

import { compile } from "sass";
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, relative, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "styles");
const outDir = join(root, "static", "css");
const checkOnly = process.argv.includes("--check");

function walk(dir) {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) return walk(path);
        if (entry.isFile() && entry.name.endsWith(".scss") && !entry.name.startsWith("_")) return [path];
        return [];
    });
}

const sources = walk(srcDir);
if (sources.length === 0) {
    console.error(`no .scss entry files found under ${relative(root, srcDir)}`);
    process.exit(1);
}

// dart-sass emits `@charset "UTF-8";` for sources carrying non-ASCII
// (Chinese comments). The Go builder concatenates all files into one
// bundle where only the first @charset would be valid, and the bundle
// is served as UTF-8 anyway — drop it.
function clean(css) {
    return css.replace(/^@charset "UTF-8";\s*/, "");
}

let stale = [];
for (const src of sources) {
    const rel = relative(srcDir, src).replaceAll(sep, "/");
    const outPath = join(outDir, rel.replace(/\.scss$/, ".css"));
    const compiled = clean(compile(src, { style: "expanded" }).css);

    if (checkOnly) {
        const current = readFileSync(outPath, "utf8");
        if (current !== compiled) stale.push(relative(root, outPath));
        continue;
    }

    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, compiled);
    console.log(`styles -> ${relative(root, outPath)}`);
}

if (checkOnly) {
    if (stale.length) {
        console.error(`stale CSS (run "npm run styles"): ${stale.join(", ")}`);
        process.exit(1);
    }
    console.log("styles check ok");
}
