/**
 * Generates the SELF-HOSTED "Material Symbols Outlined" subset consumed by the app.
 *
 * Why: previously the icon stylesheet was injected at runtime from Google Fonts
 * (JS bundle -> Google CSS -> Google woff2), which adds a third-party runtime
 * dependency and a late icon paint (FOUT) on cold loads.
 *
 * What it does:
 *   1. Reads the glyph list from MATERIAL_SYMBOLS_ICON_NAMES (single source of truth).
 *   2. Asks the Google Fonts CSS API for the exact subset (only those glyphs) pinned
 *      at wght 300.
 *   3. Downloads the subset woff2 and emits the @font-face + class pointing at it locally.
 *
 * Output (all committed):
 *   - src/assets/icons/material-symbols-outlined.woff2  (served at <baseHref>assets/icons/...)
 *   - src/styles/_material-symbols.scss  (@font-face + class, bundled via `@use` in styles.scss,
 *     so it ships inside the hashed + brotli'd main stylesheet -> no extra request).
 *   - stamps the woff2 `?v=<hash>` preload query in index.html.
 *
 * Run: `npm run generate:material-symbols-font`
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MATERIAL_SYMBOLS_ICON_NAMES } from '../src/app/shared/constants/material-symbols-icon-names.constants';

const FONT_FAMILY = 'Material Symbols Outlined';
// wght pinned to 300 (matches the app's icon weight).
const AXES = 'wght@300';
// `block` (not `swap`) so the ligature text ("send", "share", ...) never flashes
// before the glyphs are ready -> a brief invisibility is far less jarring for icons.
const FONT_DISPLAY = 'block';

const WOFF2_FILENAME = 'material-symbols-outlined.woff2';

// A recent Chrome UA so the CSS API returns a variable woff2 (older UAs get ttf/woff).
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WOFF2_OUTPUT_DIR = join(ROOT_DIR, 'src/assets/icons');
const SCSS_PARTIAL_FILE = join(ROOT_DIR, 'src/styles/_material-symbols.scss');
// baseHref-prefixed path as served + preloaded from index.html and referenced from the @font-face
// (absolute -> left external by esbuild, so it resolves at runtime; the /cats-and-mouse/ prefix
// matches the production baseHref).
const WOFF2_PUBLIC_PATH = '/cats-and-mouse/assets/icons/material-symbols-outlined.woff2';
// index.html files whose woff2 preload cache-busting query gets stamped in sync with the font.
const INDEX_FILES = [join(ROOT_DIR, 'src/index.html')];

// The subset URL has no ".woff2" extension (it's `url(...) format('woff2')`), so match on the format hint.
const WOFF2_URL_REGEX = /url\((https:\/\/[^)]+)\)\s*format\(["']woff2["']\)/g;

const shortHash = (content: Buffer | string): string =>
  createHash('sha256').update(content).digest('hex').slice(0, 8);

/** Rewrites the `?v=` cache-busting query on the woff2 preload <link> in every index file. */
const stampWoff2PreloadVersion = (woff2Version: string): void => {
  const escapedPath = WOFF2_PUBLIC_PATH.replace(/[.]/g, '\\$&');
  const regex = new RegExp(`${escapedPath}(?:\\?v=[a-f0-9]+)?`, 'g');

  for (const indexFile of INDEX_FILES) {
    const html = readFileSync(indexFile, 'utf-8');
    const stamped = html.replace(regex, `${WOFF2_PUBLIC_PATH}?v=${woff2Version}`);

    if (stamped !== html) {
      writeFileSync(indexFile, stamped);
    }
  }
};

const buildCssApiUrl = (iconNames: readonly string[]): string => {
  const params = new URLSearchParams({
    family: `${FONT_FAMILY}:${AXES}`,
    display: FONT_DISPLAY,
    icon_names: iconNames.join(',')
  });

  return `https://fonts.googleapis.com/css2?${params.toString()}`;
};

const fetchText = async (url: string): Promise<string> => {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });

  if (!response.ok) {
    throw new Error(`Request to ${url} failed: ${response.status} ${response.statusText}`);
  }

  return response.text();
};

const fetchBinary = async (url: string): Promise<Buffer> => {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });

  if (!response.ok) {
    throw new Error(`Request to ${url} failed: ${response.status} ${response.statusText}`);
  }

  return Buffer.from(await response.arrayBuffer());
};

const main = async (): Promise<void> => {
  const iconNames = [...new Set(MATERIAL_SYMBOLS_ICON_NAMES)].sort();

  if (iconNames.length === 0) {
    throw new Error('MATERIAL_SYMBOLS_ICON_NAMES is empty - nothing to subset.');
  }

  const cssApiUrl = buildCssApiUrl(iconNames);
  console.log(`Fetching subset CSS for ${iconNames.length} icons...`);
  const remoteCss = await fetchText(cssApiUrl);

  const remoteWoff2Urls = [...new Set([...remoteCss.matchAll(WOFF2_URL_REGEX)].map(m => m[1]))];

  if (remoteWoff2Urls.length !== 1) {
    // A subset of a single icon font must resolve to exactly one woff2. Anything else
    // means the API contract changed and the naive url() rewrite below is unsafe.
    throw new Error(
      `Expected exactly 1 woff2 in the returned CSS, got ${remoteWoff2Urls.length}. ` +
        `The Google Fonts API response shape may have changed.`
    );
  }

  const [remoteWoff2Url] = remoteWoff2Urls;

  console.log('Downloading woff2 subset...');
  const woff2 = await fetchBinary(remoteWoff2Url);

  // Content hash -> `?v=` query so the 1-year `immutable` cache is safe despite the stable
  // filename: identical content keeps the same URL, changed content busts it everywhere.
  const woff2Version = shortHash(woff2);

  // Point the @font-face at the served, versioned woff2. The version keeps the preloaded
  // and @font-face URLs identical.
  const scssPartial =
    `// GENERATED by scripts/generate-material-symbols-font.ts - do not edit by hand.\n` +
    `// Font family: "${FONT_FAMILY}". Re-run \`npm run generate:material-symbols-font\` after changing the icon list.\n` +
    `// Bundled into the main stylesheet via \`@use "material-symbols"\` in styles.scss.\n` +
    remoteCss.replaceAll(remoteWoff2Url, `${WOFF2_PUBLIC_PATH}?v=${woff2Version}`);

  mkdirSync(WOFF2_OUTPUT_DIR, { recursive: true });
  writeFileSync(join(WOFF2_OUTPUT_DIR, WOFF2_FILENAME), woff2);
  writeFileSync(SCSS_PARTIAL_FILE, scssPartial);
  stampWoff2PreloadVersion(woff2Version);

  console.log(
    `Done: ${WOFF2_FILENAME} (${(woff2.length / 1024).toFixed(1)} KB, v=${woff2Version}) + ` +
      `_material-symbols.scss -> bundled via styles.scss, stamped ${INDEX_FILES.length} index preload(s).`
  );
};

main().catch(error => {
  console.error(error);
  process.exit(1);
});
