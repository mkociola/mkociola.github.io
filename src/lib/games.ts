/**
 * Helpers for the `games` collection — shared by the homepage showcase, the
 * `/games` index, each game's product/privacy/support routes, and the terminal.
 *
 * Keeping slug + URL derivation here means the links rendered on a card and the
 * paths produced by `getStaticPaths` can never drift apart.
 */
import type { CollectionEntry } from 'astro:content';

export type Game = CollectionEntry<'games'>;

/** URL slug for a game: an explicit `slug` wins, else the entry id (filename). */
export function slugOf(game: Game): string {
  return game.data.slug ?? game.id;
}

export const gamePath = (slug: string) => `/games/${slug}/`;
export const privacyPath = (slug: string) => `/games/${slug}/privacy/`;
export const supportPath = (slug: string) => `/games/${slug}/support/`;

/** Sort published games for listings: by `order`, then name. */
export function sortGames(games: Game[]): Game[] {
  return [...games].sort((a, b) => a.data.order - b.data.order || a.data.name.localeCompare(b.data.name));
}

/**
 * Text-only projection handed to the client:only terminal. The terminal is a
 * serialised-prop island and a text surface, so it never receives image data —
 * just the strings it renders, plus the in-site paths to link.
 */
export interface GameTextItem {
  name: string;
  tagline: string;
  blurb: string;
  platform: string;
  status: 'live' | 'coming-soon';
  features: string[];
  path: string;
  appStoreUrl: string | null;
}

export function toTextItem(game: Game): GameTextItem {
  const slug = slugOf(game);
  return {
    name: game.data.name,
    tagline: game.data.tagline,
    blurb: game.data.blurb,
    platform: game.data.platform,
    status: game.data.status,
    features: [...game.data.features],
    path: gamePath(slug),
    appStoreUrl: game.data.appStoreUrl ?? null,
  };
}
