/**
 * Generates the social-share card at `public/og-image.png` (1200×630).
 *
 * Why a generator and not a static asset: the OG image used to be the upstream
 * "termfolio" template placeholder (it still said "Alex Reyes" long after the
 * site was rebranded). Driving the card from `site.ts` — the same single source
 * of truth the rest of the site reads — means it can never silently drift again.
 *
 * The card is a terminal window: traffic lights + `zsh` title, a `whoami`
 * prompt, the name set large in Space Grotesk, the role + a short tagline in
 * JetBrains Mono, and a footer with the domain and a few headline skills.
 *
 * Render path: hand-built SVG with the Fontsource WebFonts embedded as base64
 * `@font-face` data URIs (so glyphs — incl. the Polish `ł`/`ą` in "Kocioła" —
 * render identically everywhere, with no system-font dependency), rasterised by
 * sharp's bundled librsvg at 2× and downscaled to 1200×630 for crisp text.
 *
 * Run: `npm run og`  (also wired into `prebuild` so a build always ships a
 * current card).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
// sharp ships as Astro's image pipeline (transitive dep), so it's always present
// in this project's node_modules — both locally and in CI.
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// Pull identity from the single source of truth. Prefer a real import (Node
// ≥23.6 strips the TS types natively); fall back to a small literal-parse so an
// older Node can never break this script — and thus never break a build it's
// hooked into.
async function loadIdentity() {
  try {
    return (await import('../src/lib/site.ts')).identity;
  } catch {
    const src = readFileSync(join(root, 'src/lib/site.ts'), 'utf8');
    const block = src.slice(src.indexOf('export const identity'));
    const pick = (k) => (block.match(new RegExp(`${k}:\\s*'([^']*)'`)) || [])[1] || '';
    return { name: pick('name'), handle: pick('handle'), title: pick('title') };
  }
}
const identity = await loadIdentity();

// ── Card copy ──────────────────────────────────────────────────────────────
// Name + role come from the single source of truth. The remaining three lines
// are curated *for the card* — a condensed headline, not full site copy — so
// they're spelled out here rather than derived from the longer `tagline`.
const [firstName, ...rest] = identity.name.split(' ');
const lastName = rest.join(' ');
const COPY = {
  shellTitle: `— zsh — ${identity.handle}`,
  prompt: `${identity.handle}:~$ whoami`,
  nameLine1: firstName,                 // "Mateusz"
  nameLine2: lastName,                  // "Kocioła"
  role: identity.title,                 // "GPU Software Engineer @ Intel"
  tagline: 'Linux systems · virtualization · test automation',
  domain: 'mkociola.github.io',
  skills: 'C · Python · Linux · Ansible',
};

// ── Palette (verbatim from src/styles/global.css @theme) ─────────────────────
const C = {
  page: '#060a07',
  card: '#0a0f0a',
  border: '#213425',
  acc: '#33ff66',
  grn2: '#7ee0a3',
  muted: '#7e9b84',
  dim: '#6c8c74',
  heading: '#eef7f0',
  soft: '#dce8de',
  light: '#e3f0e6',
  dot: { red: '#ff5f56', amber: '#ffbd2e', green: '#27c93f' },
};

// ── Font embedding ───────────────────────────────────────────────────────────
const fontDir = (family) => join(root, 'node_modules/@fontsource', family, 'files');
const b64 = (p) => readFileSync(p).toString('base64');
const face = (family, weight, file) =>
  `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};` +
  `src:url(data:font/woff2;base64,${b64(file)}) format('woff2');}`;

const sg = (w) => join(fontDir('space-grotesk'), `space-grotesk-latin-${w}-normal.woff2`);
const sgExt = (w) => join(fontDir('space-grotesk'), `space-grotesk-latin-ext-${w}-normal.woff2`);
const jb = (w) => join(fontDir('jetbrains-mono'), `jetbrains-mono-latin-${w}-normal.woff2`);

const fontCss = [
  // Space Grotesk 700 — both subsets so Polish glyphs (ł, ą) are guaranteed.
  face('Space Grotesk', 700, sg(700)),
  face('Space Grotesk', 700, sgExt(700)),
  // JetBrains Mono — the terminal weights actually used on the card.
  face('JetBrains Mono', 400, jb(400)),
  face('JetBrains Mono', 500, jb(500)),
  face('JetBrains Mono', 700, jb(700)),
].join('\n');

// ── Geometry ─────────────────────────────────────────────────────────────────
const W = 1200, H = 630;
const LEFT = 84, RIGHT = 1116;
const SCALE = 2; // supersample for crisp downscaled text

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Measure a string's rendered ink width (user units) by rasterising it alone
// and trimming the uniform background. More reliable than assuming a fixed
// monospace advance, which librsvg's metrics don't match exactly.
async function inkWidth(text, family, weight, size) {
  const cw = 3000, ch = 320, pad = 60;
  const probe = `<svg xmlns="http://www.w3.org/2000/svg" width="${cw}" height="${ch}">` +
    `<defs><style>${fontCss}</style></defs>` +
    `<rect width="${cw}" height="${ch}" fill="#000"/>` +
    `<text x="${pad}" y="200" font-family="${family}" font-weight="${weight}" ` +
    `font-size="${size}" fill="#fff">${esc(text)}</text></svg>`;
  const { info } = await sharp(Buffer.from(probe))
    .trim({ threshold: 10 })
    .toBuffer({ resolveWithObject: true });
  return info.width;
}

const tagSize = 23;
// Terminal cursor sits one small gap past the end of the tagline text.
const cursorX = LEFT + (await inkWidth(COPY.tagline, 'JetBrains Mono', 400, tagSize)) + 12;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * SCALE}" height="${
  H * SCALE
}" viewBox="0 0 ${W} ${H}">
  <defs>
    <style>${fontCss}</style>
    <clipPath id="cardClip"><rect x="24" y="24" width="1152" height="582" rx="20"/></clipPath>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M40 0H0V40" fill="none" stroke="${C.grn2}" stroke-width="1" opacity="0.045"/>
    </pattern>
    <radialGradient id="vignette" cx="34%" cy="36%" r="90%">
      <stop offset="62%" stop-color="${C.page}" stop-opacity="0"/>
      <stop offset="100%" stop-color="${C.page}" stop-opacity="0.32"/>
    </radialGradient>
  </defs>

  <!-- backdrop + terminal card -->
  <rect width="${W}" height="${H}" fill="${C.page}"/>
  <rect x="24" y="24" width="1152" height="582" rx="20" fill="${C.card}"
        stroke="${C.border}" stroke-width="1.5"/>
  <g clip-path="url(#cardClip)">
    <rect x="24" y="24" width="1152" height="582" fill="url(#grid)"/>
    <rect x="24" y="24" width="1152" height="582" fill="url(#vignette)"/>
  </g>

  <!-- title bar: traffic lights + zsh tab -->
  <circle cx="96"  cy="84" r="8" fill="${C.dot.red}"/>
  <circle cx="124" cy="84" r="8" fill="${C.dot.amber}"/>
  <circle cx="152" cy="84" r="8" fill="${C.dot.green}"/>
  <text x="182" y="91" font-family="JetBrains Mono" font-weight="500" font-size="21"
        fill="${C.dim}">${esc(COPY.shellTitle)}</text>

  <!-- prompt (xml:space=preserve keeps the space before whoami) -->
  <text x="${LEFT}" y="182" font-family="JetBrains Mono" font-weight="700" font-size="28" xml:space="preserve"><tspan fill="${C.acc}">${esc(identity.handle)}</tspan><tspan fill="${C.muted}">:</tspan><tspan fill="${C.grn2}">~</tspan><tspan fill="${C.acc}">$</tspan><tspan fill="${C.light}"> whoami</tspan></text>

  <!-- name -->
  <text x="80" y="312" font-family="Space Grotesk" font-weight="700" font-size="116"
        letter-spacing="-3" fill="${C.heading}">${esc(COPY.nameLine1)}</text>
  <text x="80" y="420" font-family="Space Grotesk" font-weight="700" font-size="116"
        letter-spacing="-3" fill="${C.heading}">${esc(COPY.nameLine2)}</text>

  <!-- role -->
  <text x="${LEFT}" y="480" font-family="JetBrains Mono" font-weight="700" font-size="30"
        fill="${C.acc}">${esc(COPY.role)}</text>

  <!-- tagline + blinking-block cursor -->
  <text x="${LEFT}" y="520" font-family="JetBrains Mono" font-weight="400" font-size="${tagSize}"
        fill="${C.muted}">${esc(COPY.tagline)}</text>
  <rect x="${cursorX}" y="500" width="13" height="22" fill="${C.acc}"/>

  <!-- footer -->
  <text x="${LEFT}" y="568" font-family="JetBrains Mono" font-weight="700" font-size="23"
        fill="${C.acc}">${esc(COPY.domain)}</text>
  <text x="${RIGHT}" y="568" font-family="JetBrains Mono" font-weight="500" font-size="23"
        text-anchor="end" fill="${C.muted}">${esc(COPY.skills)}</text>
</svg>`;

const outPath = join(root, 'public/og-image.png');
await sharp(Buffer.from(svg))
  .resize(W, H, { kernel: 'lanczos3' })
  .flatten({ background: C.page })
  .png()
  .toFile(outPath);

console.log(`✓ wrote ${outPath} (${W}×${H})  —  ${COPY.nameLine1} ${COPY.nameLine2} · ${COPY.role}`);
