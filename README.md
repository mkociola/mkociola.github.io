# mateusz@kociola — personal portfolio

My personal site, "termfolio": a clean, crawlable page for humans and search
engines at [`/`](https://mkociola.github.io), and an interactive boot-sequence
terminal UI at [`/TUI`](https://mkociola.github.io/TUI). A lightweight bot-guard
sends real visitors to the terminal while keeping crawlers on the readable page.

🔗 **Live:** https://mkociola.github.io

## Stack

- **[Astro 6](https://astro.build)** — static site generator, zero JS by default
- **[Vue 3](https://vuejs.org)** — powers the interactive terminal (`client:only`)
- **[Tailwind CSS v4](https://tailwindcss.com)** — styling, via the Vite plugin
- **TypeScript** — strict mode
- Self-hosted fonts (JetBrains Mono, Space Grotesk) via Fontsource

## How it works

- **One source of truth.** Identity, contact details and shared copy live in
  [`src/lib/site.ts`](src/lib/site.ts); both the readable site and the terminal
  read from it so they never drift apart.
- **Work experience** is a content collection — Markdown entries in
  [`src/content/work/`](src/content/work/), typed by
  [`src/content.config.ts`](src/content.config.ts).
- **Projects are pulled from GitHub at build time**
  ([`src/lib/github.ts`](src/lib/github.ts)). The featured set mirrors my pinned
  repos, with layered fallbacks so a build never breaks. Pinning/unpinning a repo
  on GitHub updates the site on the next build.
- **Phone number is not shipped as plain text** — it's base64-encoded and only
  assembled in JS on an explicit user action, keeping it off naive scrapers.

## Project structure

```text
/
├── .github/workflows/   # GitHub Pages build & deploy CI
├── public/              # static assets (favicons, OG image, PWA manifest)
├── src/
│   ├── components/       # SiteHeader.astro, Terminal.vue
│   ├── content/work/     # work-experience entries (Markdown)
│   ├── layouts/          # Base.astro (head, meta, OG/Twitter tags)
│   ├── lib/              # site.ts, github.ts, bot-guard.ts
│   ├── pages/            # index.astro (readable), TUI.astro (terminal)
│   └── styles/           # global.css
├── astro.config.mjs
└── package.json
```

## Local development

Requires Node `>=22.12.0`.

```sh
npm install      # install dependencies
npm run dev      # start the dev server at http://localhost:4321
npm run build    # build the production site to ./dist/
npm run preview  # preview the production build locally
```

| Command           | Action                                        |
| :---------------- | :-------------------------------------------- |
| `npm install`     | Install dependencies                          |
| `npm run dev`     | Start local dev server at `localhost:4321`    |
| `npm run build`   | Build the production site to `./dist/`         |
| `npm run preview` | Preview the build locally before deploying    |
| `npm run astro`   | Run Astro CLI commands (`astro check`, etc.)  |

## Deployment

Hosted on **GitHub Pages** as a user site (repo
[`mkociola/mkociola.github.io`](https://github.com/mkociola/mkociola.github.io),
served at the domain root). Every push to `main` triggers
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), which builds with
the official [`withastro/action`](https://github.com/withastro/action) and
publishes via GitHub Pages.

**One-time setup:** in the repo's **Settings → Pages**, set **Source** to
**GitHub Actions**. (No `base` path is needed since this is a user site served at
the root; `site` is set in [`astro.config.mjs`](astro.config.mjs) so OG and
canonical URLs resolve absolutely.)
