#!/usr/bin/env node
/**
 * Rebuild the Chinese half of the handwritten voice.
 *
 * The sheet writes by hand in two scripts, in two different hands: the
 * Latin is the visitor's own cursive (never a webfont — a monoline hand
 * is already installed everywhere, and it is the lighter of the two).
 * Only the Chinese needs shipping, and a full CJK family is several
 * megabytes to draw a few characters — so we ask Google Fonts for a
 * subset holding just those, which lands at roughly 2 KB.
 *
 * Run it after changing the Chinese the sheet sets by hand:
 *
 *     npm run subset-font            # reads title: from _config.yaml
 *     node scripts/subset-hand-font.mjs 寂雨轩
 *
 * Rewrites static/fonts/ma-shan-zheng.woff2 in place. Nothing else needs
 * touching — layout.css already points at that path, and its
 * `unicode-range` already covers exactly these ranges.
 *
 * NOTE: the Latin must never be added to `text=`. The face is declared
 * for CJK only, so those glyphs could not render anyway — they would sit
 * in the file as dead weight. Latin words on the sheet (the title, the
 * signature, the margin note) are the system cursive's job.
 */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const FAMILY = "Ma Shan Zheng";
const OUT = new URL("../static/fonts/ma-shan-zheng.woff2", import.meta.url);
const CONFIG = new URL("../_config.yaml", import.meta.url);

// Google only answers with woff2 (rather than a much larger ttf) to a
// browser-ish UA.
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const unquote = (s) => s.replace(/^["']|["']$/g, "");

/** The `title:` under the `home:` block — what the site calls itself in
 *  Chinese. Slot lookup is ad-hoc, but it is the only Chinese string the
 *  templates take from the config: everything else the sheet hand-sets
 *  is Latin. Add the characters of any hand-set Chinese copy here (or
 *  pass them as argv) when such copy appears. */
async function fromConfig() {
  const yaml = await readFile(CONFIG, "utf8");
  const home = yaml.split(/^home:/m)[1]?.split(/^\S/m)[0] ?? "";
  const title = home.match(/^\s*title:\s*(.+?)\s*$/m)?.[1];
  return title ? [unquote(title)] : [];
}

const words = process.argv.slice(2).length ? process.argv.slice(2) : await fromConfig();
if (!words.length) throw new Error("nothing to subset — pass the glyphs as argv");

const glyphs = [...new Set(words.join(""))].join("");
if (!glyphs.trim()) throw new Error("nothing to subset");

const css = await fetch(
  `https://fonts.googleapis.com/css2?${new URLSearchParams({
    family: FAMILY,
    text: glyphs,
    display: "swap",
  })}`,
  { headers: { "User-Agent": UA } },
).then((r) => {
  if (!r.ok) throw new Error(`fonts.googleapis.com -> HTTP ${r.status}`);
  return r.text();
});

// With `text=` the API answers one @font-face per script group. For a
// pure-CJK request that is a single block, but it is not a contract — and
// woff2 cannot simply be concatenated, so bail loudly rather than writing
// a file that only holds half the glyphs.
const urls = [...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map((m) => m[1]);
if (!urls.length) throw new Error("no font url in the returned css:\n" + css);
if (urls.length > 1) {
  throw new Error(
    `the API split this request into ${urls.length} files — ask for one script at a time ` +
      `and inline both, do not concatenate woff2`,
  );
}

const font = Buffer.from(await fetch(urls[0]).then((r) => r.arrayBuffer()));
await writeFile(OUT, font);

console.log(`wrote ${fileURLToPath(OUT)}`);
console.log(`  family : ${FAMILY}`);
console.log(`  glyphs : ${glyphs}  (${[...glyphs].length} unique)`);
console.log(`  size   : ${font.length} bytes`);
