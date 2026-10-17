import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { extname, join } from 'node:path';
import { promisify } from 'node:util';
import { gzip } from 'node:zlib';

// One compression per core. Async zlib work runs on libuv's threadpool, which has 4 threads unless
// this variable says otherwise, and libuv reads it only once: when the pool starts, on the first
// compression below.
const CONCURRENCY = availableParallelism();
process.env.UV_THREADPOOL_SIZE = String(CONCURRENCY);

const DIST_DIR = 'dist';
const MIN_BYTES = 1024;
const GZIP_LEVEL = 9;
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

const gzipAsync = promisify(gzip);

let compressedCount = 0;
let skippedCount = 0;

const shouldCompress = (filePath, size) =>
  size >= MIN_BYTES && !filePath.endsWith('.gz') && COMPRESSIBLE_EXTENSIONS.has(extname(filePath).toLowerCase());

// Reads and writes stay synchronous, on the main thread: async fs would queue on the same
// threadpool, behind the compressions. Running in parallel leaves every `.gz` byte-identical to a
// one-at-a-time run, which the deploy relies on: it rejects an immutable file whose bytes changed.
const preGzipFile = async filePath => {
  const source = readFileSync(filePath);
  const compressed = await gzipAsync(source, { level: GZIP_LEVEL });

  if (compressed.length >= source.length) {
    skippedCount++;
    return;
  }

  writeFileSync(`${filePath}.gz`, compressed);
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
    await preGzipFile(filePaths[nextFileIndex++]);
  }
};

await Promise.all(Array.from({ length: CONCURRENCY }, compressRemainingFiles));

console.log(`Pre-gzip done. compressed=${compressedCount} skipped=${skippedCount}`);
