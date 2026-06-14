/**
 * Build-time GitHub project loader.
 *
 * Runs in Astro frontmatter (Node, during `astro build` / `astro dev`), so the
 * resulting project list is baked into the static HTML — crawlable, no client
 * fetch, no loading state. Re-syncs on every build.
 *
 * Curation follows the profile's *pinned* repos: their names + order are
 * scraped from the public profile page (no auth token needed), then enriched
 * with full metadata from the REST API. Layered fallbacks guarantee the build
 * always produces content even if GitHub is rate-limited or unreachable:
 *   1. pinned scrape  ->  REST details            (the happy path)
 *   2. REST repos sorted by stars + recency       (pinned scrape failed)
 *   3. hardcoded SEED of the known pinned repos    (network/API down)
 */
import { githubUsername } from './site';

export interface Project {
  name: string;
  description: string;
  language: string | null;
  stars: number;
  forks: number;
  url: string;
  homepage: string | null;
  topics: string[];
  pushedAt: string;
  pinned: boolean;
}

const PROFILE_URL = `https://github.com/${githubUsername}`;
const API = `https://api.github.com`;
const UA = { 'User-Agent': `${githubUsername}-portfolio-build`, Accept: 'application/vnd.github+json' };

/** Descriptions for repos that have none on GitHub, so cards are never empty. */
const FALLBACK_DESC: Record<string, string> = {
  SwiftLedger: 'A personal-finance ledger app built in Swift.',
};

/** Last-resort seed — the known pinned set — used only if GitHub is unreachable. */
const SEED: Project[] = [
  { name: 'typer', description: 'An app to test your typing abilities.', language: 'TypeScript', stars: 0, forks: 0, url: `${PROFILE_URL}/typer`, homepage: null, topics: [], pushedAt: '', pinned: true },
  { name: 'CUT', description: 'A multithreaded CPU usage tracker, written in C.', language: 'C', stars: 0, forks: 0, url: `${PROFILE_URL}/CUT`, homepage: null, topics: [], pushedAt: '', pinned: true },
  { name: 'weird-grep', description: 'A weird multithreaded grep.', language: 'C++', stars: 0, forks: 0, url: `${PROFILE_URL}/weird-grep`, homepage: null, topics: [], pushedAt: '', pinned: true },
  { name: 'SwiftLedger', description: FALLBACK_DESC.SwiftLedger, language: 'Swift', stars: 1, forks: 0, url: `${PROFILE_URL}/SwiftLedger`, homepage: null, topics: [], pushedAt: '', pinned: true },
];

async function fetchJSON(url: string): Promise<any> {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`GitHub ${res.status} for ${url}`);
  return res.json();
}

/** Scrape pinned repo names (in display order) from the public profile page. */
async function fetchPinnedNames(): Promise<string[]> {
  const res = await fetch(PROFILE_URL, { headers: { 'User-Agent': UA['User-Agent'] } });
  if (!res.ok) throw new Error(`profile ${res.status}`);
  const html = await res.text();
  const names: string[] = [];
  const re = /<span[^>]*class="repo"[^>]*>([^<]+)<\/span>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const name = m[1].trim();
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}

function toProject(repo: any, pinned: boolean): Project {
  return {
    name: repo.name,
    description: repo.description || FALLBACK_DESC[repo.name] || '',
    language: repo.language ?? null,
    stars: repo.stargazers_count ?? 0,
    forks: repo.forks_count ?? 0,
    url: repo.html_url,
    homepage: repo.homepage || null,
    topics: repo.topics ?? [],
    pushedAt: repo.pushed_at ?? '',
    pinned,
  };
}

// Memoize per build/dev session: both pages call this, and Astro re-runs
// frontmatter on every dev request — without this we'd burn the unauthenticated
// rate limit (60/hr) on reloads. Keyed by the `all` flag.
const cache = new Map<string, Promise<Project[]>>();

/**
 * Returns the projects to feature. By default: the pinned repos in profile
 * order. Pass `{ all: true }` to also include the rest of the (non-fork) repos,
 * sorted pinned-first, then by stars, then most-recently-pushed.
 */
export function getProjects(opts: { all?: boolean } = {}): Promise<Project[]> {
  const key = opts.all ? 'all' : 'pinned';
  let hit = cache.get(key);
  if (!hit) {
    hit = loadProjects(opts);
    cache.set(key, hit);
  }
  return hit;
}

async function loadProjects(opts: { all?: boolean } = {}): Promise<Project[]> {
  try {
    const [pinnedNames, repos] = await Promise.all([
      fetchPinnedNames().catch(() => [] as string[]),
      fetchJSON(`${API}/users/${githubUsername}/repos?per_page=100&sort=pushed`) as Promise<any[]>,
    ]);

    const byName = new Map<string, any>(repos.filter((r) => !r.fork).map((r) => [r.name, r]));
    const pinnedSet = new Set(pinnedNames);

    // Featured = pinned names that exist, in profile order.
    const featured = pinnedNames.map((n) => byName.get(n)).filter(Boolean).map((r) => toProject(r, true));

    if (!opts.all) {
      // No pinned info? Fall back to top repos by stars then recency.
      if (featured.length === 0) {
        return [...byName.values()]
          .map((r) => toProject(r, false))
          .sort((a, b) => b.stars - a.stars || b.pushedAt.localeCompare(a.pushedAt))
          .slice(0, 4);
      }
      return featured;
    }

    const rest = [...byName.values()]
      .filter((r) => !pinnedSet.has(r.name))
      .map((r) => toProject(r, false))
      .sort((a, b) => b.stars - a.stars || b.pushedAt.localeCompare(a.pushedAt));

    return [...featured, ...rest];
  } catch (err) {
    console.warn('[github] falling back to seed projects:', (err as Error).message);
    return SEED;
  }
}
