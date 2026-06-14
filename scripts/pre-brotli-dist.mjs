import { brotliCompressSync, constants } from "node:zlib";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";

const DIST_DIR = "dist";
const MIN_BYTES = 1024;
const BROTLI_QUALITY = 11;
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
  !filePath.endsWith(".br") &&
  COMPRESSIBLE_EXTENSIONS.has(extname(filePath).toLowerCase());

const preBrotliFile = (filePath) => {
  const source = readFileSync(filePath);
  const compressed = brotliCompressSync(source, {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: BROTLI_QUALITY,
    },
  });

  if (compressed.length >= source.length) {
    skippedCount++;
    return;
  }

  writeFileSync(`${filePath}.br`, compressed);
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
      preBrotliFile(filePath);
    }
  }
};

walk(DIST_DIR);

console.log(`Pre-brotli done. compressed=${compressedCount} skipped=${skippedCount}`);
