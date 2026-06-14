/**
 * Single source of truth for identity, contact and the static copy shared by
 * both surfaces — the readable site ("/") and the terminal ("/TUI"). Keeping it
 * here means the two never drift apart.
 *
 * Branding rule (per spec): the full-name handle `mateusz@kociola` is used
 * wherever the real name reads best (header logo, page titles); the nickname
 * `kociolson` drives the casual terminal feel (shell prompt, boot log, $HOME).
 */

export const identity = {
  name: 'Mateusz Kocioła',
  nick: 'kociolson',
  /** full-name handle for the header logo / titles, e.g. `mateusz@kociola:~$` */
  handle: 'mateusz@kociola',
  role: 'Software Engineer',
  /** longer role used in hero / whoami */
  title: 'GPU Software Engineer @ Intel',
  location: 'Wrocław, Poland',
  /** one-liner under the name on the readable site */
  tagline:
    'Software engineer working close to the metal — Linux systems, virtualization and test automation by day; web development and security on the side.',
  /** interests, surfaced in the hero blurb and as terminal flavour */
  interests: ['linux systems', 'web development', 'cybersecurity'],
  hobbies: ['motorcycles', 'rubik’s cubes'],
} as const;

export const githubUsername = 'mkociola';

export const contact = {
  /**
   * Contact channels (email + phone) are deliberately NOT shipped as plain text.
   * Crawlers/bots stay on "/" (see bot-guard) and would otherwise scrape a
   * `mailto:`/`tel:` link, so both are base64-encoded here and only assembled in
   * JS on an explicit user action (click-to-reveal on "/", `email`/`phone` in
   * the TUI). This keeps them off naive harvesters while still reachable by real
   * humans. Decode with `atob()` — never interpolate the decoded value into HTML.
   */
  email: {
    displayB64: 'bWF0ZXVzei5rb2Npb2xhQGljbG91ZC5jb20=', // "mateusz.kociola@icloud.com"
    hrefB64: 'bWFpbHRvOm1hdGV1c3oua29jaW9sYUBpY2xvdWQuY29t', // "mailto:mateusz.kociola@icloud.com"
  },
  github: { label: 'github.com/mkociola', url: 'https://github.com/mkociola' },
  linkedin: { label: 'linkedin', url: 'https://www.linkedin.com/in/mateusz-kocioła-510678230/' },
  phone: {
    displayB64: 'KzQ4IDc5MSA3MzEgMzg4', // "+48 791 731 388"
    hrefB64: 'dGVsOis0ODc5MTczMTM4OA==', // "tel:+48791731388"
  },
} as const;

/** Whether the LinkedIn link is real yet (hide the link until it is). */
export const hasLinkedIn = !contact.linkedin.url.includes('REPLACE-ME');

export const skillGroups = [
  { label: 'languages/', items: ['C / C++', 'Python', 'Bash', 'TypeScript', 'Swift'] },
  { label: 'systems/', items: ['Linux (RHEL · SLES · Ubuntu)', 'Ansible', 'Docker', 'SR-IOV', 'GPU passthrough'] },
  { label: 'web/', items: ['Vue', 'Astro', 'Node.js', 'Django'] },
  { label: 'practice/', items: ['CI/CD · GitHub Actions', 'Fuzz testing', 'HPC', 'Kernel-level debug'] },
] as const;

/** Spoken languages — shown small on the readable site, as a line in the TUI. */
export const languages = [
  { name: 'Polish', level: 'native' },
  { name: 'English', level: 'fluent' },
] as const;

/** About / hero prose, kept as paragraphs so both surfaces can reuse it. */
export const about = {
  lead: 'GPU Software Engineer at Intel — Linux systems & developer tooling.',
  paragraphs: [
    'I build test environments and automation close to the hardware: virtualization (SR-IOV, GPU passthrough), kernel-feature validation, and the Ansible/Bash/Python plumbing that ties it all together.',
    'Off the clock I write web apps, poke at security, ride motorcycles and solve Rubik’s cubes.',
  ],
} as const;
