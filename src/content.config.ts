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
    /** Lower = higher on the page. */
    order: z.number(),
    /** Hide without deleting (e.g. drafts / TODO entries). */
    draft: z.boolean().default(false),
  }),
});

export const collections = { work };
