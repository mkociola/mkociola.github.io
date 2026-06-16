import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * `work` — your employment history, authored as Markdown so each role can carry
 * a rich bullet list in its body. Both the readable site and the terminal read
 * from here, so this collection is the single source of truth for experience.
 *
 * Sorting is driven by `order` (ascending, most-recent first).
 */
const work = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/work' }),
  schema: z.object({
    company: z.string(),
    role: z.string(),
    location: z.string().optional(),
    /** Human-readable span shown in the UI, e.g. "2024 — present". */
    period: z.string(),
    /** True for the current role (drives "present" styling / accents). */
    current: z.boolean().default(false),
    /** One-line summary used in list/JSON views. */
    summary: z.string(),
    /** Tech stack chips. */
    stack: z.array(z.string()).default([]),
    /**
     * Formal résumé voice for the downloadable CV (`/cv`). The site and terminal
     * read the casual `summary` + Markdown body; the CV reads these instead so
     * the two registers never have to compromise. All optional — the CV falls
     * back to `role`/`summary` when a field is absent.
     */
    cvRole: z.string().optional(),
    cvSummary: z.string().optional(),
    cvHighlights: z.array(z.string()).default([]),
    /** Lower = higher on the page. */
    order: z.number(),
    /** Hide without deleting (e.g. drafts / TODO entries). */
    draft: z.boolean().default(false),
  }),
});

/**
 * `games` — the apps I publish to the App Store. Distinct from `projects`
 * (which are auto-fetched from public GitHub repos): games are products, their
 * source repos can be private, so they're curated here by hand. This collection
 * is the single source of truth for the homepage showcase, each game's product
 * page, the terminal `games` view, and the generated privacy/support pages.
 *
 * Images (icon + screenshots) live next to the markdown under src/assets and are
 * validated/optimised via the `image()` helper, so `<Image>` can emit responsive
 * WebP. The markdown body is the longer "about the app" description.
 */
const games = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/games' }),
  schema: ({ image }) =>
    z.object({
      /** Display name, e.g. "Minesweeper: Refined". */
      name: z.string(),
      /** URL slug; defaults to the filename when omitted (see slugOf in lib/games). */
      slug: z.string().optional(),
      /** One-liner shown under the name (the App Store subtitle). */
      tagline: z.string(),
      /** 1–2 sentence pitch used on cards and meta descriptions. */
      blurb: z.string(),
      /** Target platform(s), shown as a chip — e.g. "iPhone", "iOS · iPadOS". */
      platform: z.string().default('iOS'),
      icon: image(),
      /** Screenshots with per-image alt text (each shot shows a distinct screen). */
      screenshots: z.array(z.object({ src: image(), alt: z.string() })).default([]),
      /** App Store listing URL — omit until the app is published. */
      appStoreUrl: z.string().url().optional(),
      /** Drives the CTA: a real badge when live, a "coming soon" pill otherwise. */
      status: z.enum(['live', 'coming-soon']).default('coming-soon'),
      /** Short feature highlights (App Store-style bullets). */
      features: z.array(z.string()).default([]),
      /** Legal entity / author name shown in the privacy policy. */
      developer: z.string(),
      /** Privacy-policy effective date, ISO (YYYY-MM-DD). */
      effectiveDate: z.string(),
      /**
       * Whether the app collects any personal data. The generated privacy
       * policy is written for the `false` (no-collection) case; flip with care.
       */
      collectsData: z.boolean().default(false),
      /** Lower = earlier in listings. */
      order: z.number().default(0),
      /** Hide without deleting. */
      draft: z.boolean().default(false),
    }),
});

export const collections = { work, games };
