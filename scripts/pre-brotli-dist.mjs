import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { extname, join } from 'node:path';
import { promisify } from 'node:util';
import { brotliCompress, constants } from 'node:zlib';

// One compression per core. Async zlib work runs on libuv's threadpool, which has 4 threads unless
// this variable says otherwise, and libuv reads it only once: when the pool starts, on the first
// compression below.
const CONCURRENCY = availableParallelism();
process.env.UV_THREADPOOL_SIZE = String(CONCURRENCY);

const DIST_DIR = 'dist';
const MIN_BYTES = 1024;
const BROTLI_QUALITY = 11;
const COMPRESSIBLE_EXTENSIONS = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.geojson',
  '.mjs',
  '.svg',
  '.txt',
  '.webmanifest',
  '.xml'
]);

const brotliCompressAsync = promisify(brotliCompress);

let compressedCount = 0;
let skippedCount = 0;

const shouldCompress = (filePath, size) =>
  size >= MIN_BYTES && !filePath.endsWith('.br') && COMPRESSIBLE_EXTENSIONS.has(extname(filePath).toLowerCase());

// Reads and writes stay synchronous, on the main thread: async fs would queue on the same
// threadpool, behind the compressions. Running in parallel leaves every `.br` byte-identical to a
// one-at-a-time run, which the deploy relies on: it rejects an immutable file whose bytes changed.
const preBrotliFile = async filePath => {
  const source = readFileSync(filePath);
  const compressed = await brotliCompressAsync(source, {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: BROTLI_QUALITY
    }
  });

  if (compressed.length >= source.length) {
    skippedCount++;
    return;
  }

  writeFileSync(`${filePath}.br`, compressed);
  compressedCount++;
};

const walk = (dirPath, files = []) => {
  for (const dirent of readdirSync(dirPath, { withFileTypes: true })) {
    const filePath = join(dirPath, dirent.name);

    if (dirent.isDirectory()) {
      walk(filePath, files);
      continue;
    }

    if (!dirent.isFile()) {
      continue;
    }

    const { size } = statSync(filePath);

    if (shouldCompress(filePath, size)) {
      files.push({ filePath, size });
    }
  }

  return files;
};

// Largest first, so the slowest compressions never start last and finish alone.
const filePaths = walk(DIST_DIR)
  .sort((a, b) => b.size - a.size)
  .map(({ filePath }) => filePath);
let nextFileIndex = 0;

const compressRemainingFiles = async () => {
  while (nextFileIndex < filePaths.length) {
    await preBrotliFile(filePaths[nextFileIndex++]);
  }
};

await Promise.all(Array.from({ length: CONCURRENCY }, compressRemainingFiles));

console.log(`Pre-brotli done. compressed=${compressedCount} skipped=${skippedCount}`);
