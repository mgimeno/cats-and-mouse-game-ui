import { gzipSync } from "node:zlib";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";

const DIST_DIR = "dist";
const MIN_BYTES = 1024;
const GZIP_LEVEL = 9;
const COMPRESSIBLE_EXTENSIONS = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".mjs",
  ".svg",
  ".txt",
  ".webmanifest",
  ".xml",
]);

let compressedCount = 0;
let skippedCount = 0;

const shouldCompress = (filePath, size) =>
  size >= MIN_BYTES &&
  !filePath.endsWith(".gz") &&
  COMPRESSIBLE_EXTENSIONS.has(extname(filePath).toLowerCase());

const preGzipFile = (filePath) => {
  const source = readFileSync(filePath);
  const compressed = gzipSync(source, { level: GZIP_LEVEL });

  if (compressed.length >= source.length) {
    skippedCount++;
    return;
  }

  writeFileSync(`${filePath}.gz`, compressed);
  compressedCount++;
};

const walk = (dirPath) => {
  for (const dirent of readdirSync(dirPath, { withFileTypes: true })) {
    const filePath = join(dirPath, dirent.name);

    if (dirent.isDirectory()) {
      walk(filePath);
      continue;
    }

    if (!dirent.isFile()) {
      continue;
    }

    const { size } = statSync(filePath);

    if (shouldCompress(filePath, size)) {
      preGzipFile(filePath);
    }
  }
};

walk(DIST_DIR);

console.log(`Pre-gzip done. compressed=${compressedCount} skipped=${skippedCount}`);
