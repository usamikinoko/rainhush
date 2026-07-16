import { readFile, chmod, mkdir, writeFile, rm } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));

const OWNER = "usamikinoko";
const REPO = "rainhush";
const BIN_NAME = process.platform === "win32" ? "rash.exe" : "rash";
const BIN_DIR = join(__dirname, "bin");
const BIN_PATH = join(BIN_DIR, BIN_NAME);

// Map Node.js platform/arch to release asset names
function getAssetName(version) {
  const platform = {
    "win32": "windows",
    "darwin": "darwin",
    "linux": "linux",
  }[process.platform] || process.platform;

  const arch = {
    "x64": "amd64",
    "arm64": "arm64",
  }[process.arch] || process.arch;

  const ext = process.platform === "win32" ? ".zip" : ".tar.gz";
  return `rash_${platform}_${arch}${ext}`;
}

async function getVersion() {
  try {
    const pkg = JSON.parse(await readFile(join(__dirname, "package.json"), "utf-8"));
    return pkg.version;
  } catch {
    return "latest";
  }
}

async function downloadBinary(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  await pipeline(res.body, createWriteStream(dest));
}

async function extractArchive(archivePath, extractTo) {
  const ext = archivePath.endsWith(".zip") ? ".zip" : ".tar.gz";

  if (ext === ".zip") {
    // Windows: use PowerShell to extract
    execSync(`powershell -Command "Expand-Archive -Path '${archivePath}' -DestinationPath '${extractTo}' -Force"`, { stdio: "pipe" });
  } else {
    // Unix: use tar
    execSync(`tar -xzf "${archivePath}" -C "${extractTo}"`, { stdio: "pipe" });
  }
}

function findBinary(dir) {
  // On Windows, npm expects the binary at bin/rash, and creates a rash.cmd shim.
  // But the actual binary is rash.exe. The shim handles this transparently.
  return join(dir, BIN_NAME);
}

async function main() {
  // Skip if already installed (e.g., npm ci with frozen install)
  try {
    await import("node:fs").then(fs => fs.promises.access(BIN_PATH));
    return;
  } catch {
    // Not installed yet - proceed
  }

  const version = await getVersion();
  const assetName = getAssetName(`v${version}`);
  const downloadUrl = `https://github.com/${OWNER}/${REPO}/releases/download/v${version}/${assetName}`;

  // Also try "latest" tag for dev versions
  const fallbackUrl = `https://github.com/${OWNER}/${REPO}/releases/latest/download/${assetName}`;

  await mkdir(BIN_DIR, { recursive: true });

  const archivePath = join(BIN_DIR, assetName);

  try {
    console.log(`Downloading rash v${version} for ${process.platform}-${process.arch}...`);
    await downloadBinary(downloadUrl, archivePath);
  } catch (e) {
    console.log(`Release v${version} not found, trying latest...`);
    try {
      await downloadBinary(fallbackUrl, archivePath);
    } catch (e2) {
      console.warn("Could not download prebuilt binary. Build from source: go install github.com/usamikinoko/rainhush@latest");
      return;
    }
  }

  await extractArchive(archivePath, BIN_DIR);

  // Clean up archive
  await rm(archivePath, { force: true });

  if (process.platform !== "win32") {
    await chmod(BIN_PATH, 0o755);
  }

  console.log("Rash installed successfully.");
}

main().catch((err) => {
  console.warn("Rash binary download failed:", err.message);
  console.warn("Build from source: go install github.com/usamikinoko/rainhush@latest");
});