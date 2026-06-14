<script setup lang="ts">
/**
 * Boot + TUI terminal — a faithful Vue port of "Boot TUI.dc.html".
 *
 * Flow: a green-phosphor POST/boot sequence types itself out, then resolves
 * into a ranger-style TUI — file tree (left), syntax-highlighted preview pane
 * (right) and a real shell (bottom) that drives both. Click files, ↑/↓ to
 * browse, or type commands; tab-complete, history and easter eggs included.
 *
 * "exit terminal" leaves for the readable GUI at /?gui=1 (the gui flag keeps
 * the bot-guard from bouncing the visitor straight back here).
 */
import { reactive, ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue';

type Weight = 400 | 500 | 600 | 700;
interface Seg {
  t: string;
  c: string;
  w: Weight;
}
interface Line {
  segs: Seg[];
}

// ---- props: real content, supplied by the Astro page ---------------------
// All data flows in from /TUI (the work collection + the GitHub fetch + site
// config), so this component holds zero hardcoded identity/content.
interface WorkItem {
  role: string;
  company: string;
  period: string;
  summary: string;
  stack: string[];
}
interface ProjectItem {
  name: string;
  description: string;
  language: string | null;
  stars: number;
  url: string;
  pinned: boolean;
}
interface SkillGroup {
  label: string;
  items: string[];
}
interface Identity {
  name: string;
  nick: string;
  handle: string;
  role: string;
  title: string;
  location: string;
}
interface ContactInfo {
  emailDisplayB64: string;
  emailHrefB64: string;
  github: string;
  linkedin: string | null;
  phoneDisplayB64: string;
  phoneHrefB64: string;
}
interface SpokenLang {
  name: string;
  level: string;
}
const props = defineProps<{
  identity: Identity;
  work: WorkItem[];
  projects: ProjectItem[];
  skills: SkillGroup[];
  about: { lead: string; paragraphs: string[]; interests: string[]; hobbies: string[] };
  contact: ContactInfo;
  languages: SpokenLang[];
}>();

const id = props.identity;
const host = `${id.nick}@portfolio`;
const githubShort = props.contact.github.replace(/^https?:\/\//, '');

// ---- palette (ported verbatim) -------------------------------------------
const C = {
  acc: '#33ff66',
  dim: '#557a5e',
  txt: '#b9d4bf',
  wht: '#e9f7ee',
  amb: '#ffd866',
  err: '#ff6b6b',
  grn2: '#7ee0a3',
} as const;

const SY = {
  kw: '#5cff9d',
  str: '#cfe88f',
  key: '#57ffa0',
  num: '#9be08a',
  com: '#4e7d5e',
  pun: '#6b9476',
  head: '#d9ffe6',
  txt: '#a8d8b4',
  acc: '#33ff66',
  dim: '#557a5e',
} as const;

const files = ['about.md', 'experience.json', 'skills.ts', 'projects.md', 'contact.md'];
const CMDS = [
  'about', 'cat', 'clear', 'contact', 'date', 'echo', 'email', 'exit', 'experience', 'guess',
  'help', 'history', 'ls', 'open', 'phone', 'projects', 'pwd', 'resume', 'skills', 'sudo', 'top', 'whoami',
];
// Easter eggs — undocumented in `help`, listed by `cat .secrets`, and (since
// they're discoverable there) folded into tab-completion too.
const EGGS = ['cube', 'rubik', 'ride', 'moto', 'hello', 'hi', 'hey', 'rm'];

const GUI_URL = '/?gui=1';

// ---- state ---------------------------------------------------------------
const state = reactive({
  phase: 'boot' as 'boot' | 'tui',
  bootLines: [] as Line[],
  selected: 0,
  lines: [] as Line[],
  input: '',
  hist: [] as string[],
  histIdx: -1,
  mode: 'shell' as 'shell' | 'guess',
  secret: 0,
  guesses: 0,
});

const scrollA = ref<HTMLElement | null>(null);
const inputA = ref<HTMLInputElement | null>(null);
const previewRef = ref<HTMLElement | null>(null);
const bootRef = ref<HTMLElement | null>(null);

// ---- responsive: desktop three-pane vs mobile split-view -----------------
// The terminal route renders the desktop "Boot TUI" three-pane layout at
// ≥768px, and the "Split view" mobile TUI below it (per design_handoff_mobile_tui):
// the file tree reflows into a horizontal chip rail and the preview + shell
// stack so both stay visible at once. Both layouts are the same component over
// the same state — only the template differs — so switching is a pure re-render.
const MOBILE_MQ = '(max-width: 767px)';
const isMobile = ref(
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(MOBILE_MQ).matches
    : false,
);
let mql: MediaQueryList | null = null;
function onMqChange(e: MediaQueryListEvent) {
  isMobile.value = e.matches;
}

let timers: ReturnType<typeof setTimeout>[] = [];
let booted = false;
let entered = false;
let rebooting = false;
let onKeyGlobal: ((e: KeyboardEvent) => void) | null = null;

function T(fn: () => void, ms: number) {
  timers.push(setTimeout(fn, ms));
}

// ---- segment / line helpers ----------------------------------------------
function s(t: string, c?: string, w?: Weight): Seg {
  return { t, c: c || C.txt, w: w || 400 };
}
function push(segs: Seg[]) {
  state.lines.push({ segs });
}
function pushMany(arr: Seg[][]) {
  for (const segs of arr) state.lines.push({ segs });
}
function blank(): Seg[] {
  return [];
}
function promptSegs(cmd: string): Seg[] {
  return [
    s(host, C.acc, 500),
    s(':', C.dim),
    s('~', C.grn2),
    s('$ ', C.acc, 500),
    s(cmd, C.wht),
  ];
}

// ---- boot sequence -------------------------------------------------------
// Extracted from onMounted so `sudo rm -rf /` can replay it (a real "reboot").
function runBoot() {
  state.phase = 'boot';
  state.bootLines = [];
  state.lines = [];
  entered = false;

  if (onKeyGlobal) window.removeEventListener('keydown', onKeyGlobal);
  onKeyGlobal = (e: KeyboardEvent) => {
    if (state.phase === 'boot') {
      e.preventDefault();
      skipBoot();
    }
  };
  window.addEventListener('keydown', onKeyGlobal);

  const seq: Seg[][] = [
    [s('SeaBIOS (version 1.16.3-portfolio)', C.dim)],
    [s('Booting from Hard Disk...', C.dim)],
    [],
    [s('[    0.000000] ', C.dim), s(`Linux version 6.8.0-${id.nick} (${host})`, C.txt)],
    [s('[    0.142051] ', C.dim), s('Memory: 65536K/65536K available', C.txt)],
    [s('[    0.318442] ', C.dim), s('Detecting hardware ...', C.txt)],
    [s('[    0.501233]   ', C.dim), s('xpu0: SR-IOV virtual function', C.txt), s('   [ OK ]', C.acc)],
    [s('[    0.664910]   ', C.dim), s('input: mechanical keyboard', C.txt), s('   [ OK ]', C.acc)],
    [s('[    0.840117]   ', C.dim), s('coffee subsystem online', C.txt), s('   [ OK ]', C.acc)],
    [s('[    1.093004] ', C.dim), s(`Mounting /home/${id.nick} ... `, C.txt), s('done', C.acc)],
    [s('[    1.245690] ', C.dim), s('Loading buffers: about experience skills projects ... ', C.txt), s('done', C.acc)],
    [s('[    1.511882] ', C.dim), s('Starting portfolio.service ...', C.txt), s('   [ OK ]', C.acc)],
    [s('[    1.690245] ', C.dim), s('Reached target Graphical Interface', C.txt)],
    [],
    [s('welcome — launching workspace', C.acc, 500)],
  ];
  const reduce =
    typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) {
    // Respect reduced-motion: render the boot log instantly, no timed type-out,
    // then settle into the workspace after a single short beat.
    seq.forEach((ln) => state.bootLines.push({ segs: ln }));
    T(() => enterTui(), 600);
  } else {
    seq.forEach((ln, i) => T(() => state.bootLines.push({ segs: ln }), 260 + i * 235));
    T(() => enterTui(), 260 + seq.length * 235 + 650);
  }
}

onMounted(() => {
  mql = window.matchMedia(MOBILE_MQ);
  isMobile.value = mql.matches;
  mql.addEventListener('change', onMqChange);
  if (booted) return;
  booted = true;
  runBoot();
});

onBeforeUnmount(() => {
  timers.forEach(clearTimeout);
  if (onKeyGlobal) window.removeEventListener('keydown', onKeyGlobal);
  mql?.removeEventListener('change', onMqChange);
});

function skipBoot() {
  timers.forEach(clearTimeout);
  timers = [];
  enterTui();
}

function enterTui() {
  if (entered) return;
  entered = true;
  if (onKeyGlobal) {
    window.removeEventListener('keydown', onKeyGlobal);
    onKeyGlobal = null;
  }
  state.phase = 'tui';
  state.lines = [
    {
      segs: [
        s('type ', C.dim),
        s('help', C.acc),
        s('  ·  click a file ↑  ·  ↑/↓ to browse  ·  ', C.dim),
        s('exit', C.acc),
        s(' to leave for the GUI', C.dim),
      ],
    },
    { segs: [] },
  ];
  if (rebooting) {
    rebooting = false;
    pushMany([
      [s('...kidding. restored from git.', C.txt)],
      [s('everything here is version controlled. you cannot hurt me.', C.dim)],
      [],
    ]);
  }
  T(() => focusA(), 120);
}

// ---- scrolling / focus ---------------------------------------------------
// Mirror the original componentDidUpdate: pin shell + boot panes to the bottom
// whenever their content grows.
watch(
  () => state.lines.length,
  () => nextTick(() => { if (scrollA.value) scrollA.value.scrollTop = scrollA.value.scrollHeight; }),
);
watch(
  () => state.bootLines.length,
  () => nextTick(() => { if (bootRef.value) bootRef.value.scrollTop = bootRef.value.scrollHeight; }),
);
// Layout swap (rotate / resize across the breakpoint) re-binds the refs to the
// other template — re-pin the shell to the bottom and restore focus there.
watch(isMobile, () =>
  nextTick(() => {
    if (scrollA.value) scrollA.value.scrollTop = scrollA.value.scrollHeight;
    if (state.phase === 'tui') focusActive();
  }),
);

function focusA() {
  inputA.value?.focus();
}
function focusActive() {
  T(() => focusA(), 80);
}

// ---- file selection ------------------------------------------------------
function selectByIndex(i: number) {
  const n = files.length;
  state.selected = Math.max(0, Math.min(n - 1, i));
  nextTick(() => { if (previewRef.value) previewRef.value.scrollTop = 0; });
}
function selectByName(name: string) {
  const i = files.indexOf(name);
  if (i >= 0) selectByIndex(i);
}

// ---- navigation ----------------------------------------------------------
function exitTerminal() {
  window.location.href = GUI_URL;
}
function scrollShellTop() {
  if (scrollA.value) scrollA.value.scrollTop = 0;
  focusActive();
}

// ---- input handling ------------------------------------------------------
function onInput(e: Event) {
  state.input = (e.target as HTMLInputElement).value;
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    const v = state.input;
    const trimmed = v.trim();
    state.input = '';
    if (trimmed) state.hist = state.hist.concat([v]);
    state.histIdx = -1;
    exec(v);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (state.input === '') {
      selectByIndex(state.selected - 1);
      return;
    }
    if (!state.hist.length) return;
    const idx = state.histIdx < 0 ? state.hist.length - 1 : Math.max(0, state.histIdx - 1);
    state.histIdx = idx;
    state.input = state.hist[idx];
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (state.input === '') {
      selectByIndex(state.selected + 1);
      return;
    }
    if (state.histIdx < 0) return;
    const idx = state.histIdx + 1;
    if (idx >= state.hist.length) {
      state.histIdx = -1;
      state.input = '';
    } else {
      state.histIdx = idx;
      state.input = state.hist[idx];
    }
  } else if (e.key === 'Tab') {
    e.preventDefault();
    complete();
  } else if (e.key === 'c' && e.ctrlKey) {
    e.preventDefault();
    push(promptSegs(state.input + '^C'));
    state.input = '';
    state.mode = 'shell';
  } else if (e.key === 'l' && e.ctrlKey) {
    e.preventDefault();
    state.lines = [];
  }
}

function complete() {
  const v = state.input;
  if (!v) return;
  if (v.startsWith('cat ') || v.startsWith('open ')) {
    const sp = v.indexOf(' ');
    const head = v.slice(0, sp + 1);
    const part = v.slice(sp + 1);
    const m = files.filter((f) => f.startsWith(part));
    if (m.length === 1) state.input = head + m[0];
    else if (m.length > 1) push([s(m.join('   '), C.dim)]);
    return;
  }
  if (v.includes(' ')) return;
  const m = CMDS.concat(EGGS).filter((c) => c.startsWith(v));
  if (m.length === 1) state.input = m[0] + ' ';
  else if (m.length > 1) push([s(m.join('   '), C.dim)]);
}

// ---- command execution ---------------------------------------------------
function exec(raw: string) {
  const cmd = raw.trim();
  push(promptSegs(cmd));
  if (!cmd) return;
  if (state.mode === 'guess') {
    handleGuess(cmd);
    return;
  }
  dispatch(cmd);
}

function dispatch(cmd: string) {
  const parts = cmd.split(/\s+/);
  const name = parts[0].toLowerCase();
  const args = parts.slice(1).join(' ');
  const out: Seg[][] = [];
  const h = (c2: string, d: string): Seg[] => [s('  ' + c2.padEnd(14), C.acc), s(d, C.txt)];

  switch (name) {
    case 'help':
      out.push(blank());
      out.push(h('about', 'open about.md ↑'));
      out.push(h('experience', 'open experience.json ↑'));
      out.push(h('projects', 'open projects.md ↑'));
      out.push(h('skills', 'open skills.ts ↑'));
      out.push(h('contact', 'open contact.md ↑'));
      out.push(h('email', 'reveal my email ✉'));
      out.push(h('phone', 'reveal my number ☎'));
      out.push(h('open <file>', 'open any file in the viewer'));
      out.push(h('ls', 'list the workspace'));
      out.push(h('exit', 'leave for the readable site ↗'));
      out.push(h('clear', 'clear the shell'));
      out.push(blank());
      out.push([s('  ↑/↓ browse files · click a file · tab completes · there are easter eggs.', C.dim)]);
      out.push(blank());
      break;
    case 'whoami':
      out.push([s(id.name, C.wht, 700), s(`  —  ${id.title} · ${id.location}`, C.txt)]);
      out.push([s('browse files above ↑ or type ', C.dim), s('help', C.acc), s('.', C.dim)]);
      break;
    case 'about':
      selectByName('about.md');
      out.push([s('→ opened ', C.dim), s('about.md', C.acc), s(' ↑', C.dim)]);
      break;
    case 'experience':
    case 'work':
      selectByName('experience.json');
      out.push([s('→ opened ', C.dim), s('experience.json', C.acc), s(' ↑', C.dim)]);
      break;
    case 'projects':
      selectByName('projects.md');
      out.push([s('→ opened ', C.dim), s('projects.md', C.acc), s(' ↑', C.dim)]);
      break;
    case 'skills':
      selectByName('skills.ts');
      out.push([s('→ opened ', C.dim), s('skills.ts', C.acc), s(' ↑', C.dim)]);
      break;
    case 'contact':
      selectByName('contact.md');
      out.push([s('→ opened ', C.dim), s('contact.md', C.acc), s(' ↑', C.dim)]);
      break;
    case 'open':
      if (files.includes(args)) {
        selectByName(args);
        out.push([s('→ opened ', C.dim), s(args, C.acc), s(' ↑', C.dim)]);
      } else {
        out.push([s('open: file not found: ' + (args || '(none)'), C.err), s('  — try ls', C.dim)]);
      }
      break;
    case 'resume':
    case 'cv':
      selectByName('experience.json');
      out.push([s('→ no PDF here — the CV lives in ', C.dim), s('experience.json', C.acc), s(' ↑ and on ', C.dim), s(githubShort, C.wht, 500)]);
      break;
    case 'email':
    case 'mail':
      out.push([s('✉  ', C.amb), s(atob(props.contact.emailDisplayB64), C.wht, 600), s('   — say hi.', C.dim)]);
      break;
    case 'phone':
    case 'call':
      out.push([s('☎  ', C.amb), s(atob(props.contact.phoneDisplayB64), C.wht, 600), s('   — go on, I pick up.', C.dim)]);
      break;
    case 'cube':
    case 'rubik':
      out.push([s('solved in ', C.txt), s('8.42s', C.acc, 600), s('. CFOP. ', C.dim), s('PB is none of your business.', C.dim)]);
      break;
    case 'ride':
    case 'moto':
      out.push([s('🏍  ', C.amb), s('twist throttle. ', C.txt), s('ATGATT.', C.acc), s(' brb.', C.dim)]);
      break;
    case 'ls':
      out.push([s(files.join('   '), C.txt), s('   .secrets', C.dim)]);
      break;
    case 'cat':
      if (!args) {
        out.push([s('cat: missing operand. try: cat about.md', C.dim)]);
        break;
      }
      if (files.includes(args)) {
        selectByName(args);
        out.push([s('→ opened ' + args + ' in the viewer ↑', C.dim)]);
        break;
      }
      if (args === '.secrets') {
        out.push([s('you found the drawer. here is everything in it:', C.amb)]);
        out.push(blank());
        out.push(h('guess', 'a little number game'));
        out.push(h('cube', "the rubik's cube  ·  alias: rubik"));
        out.push(h('ride', 'two wheels  ·  alias: moto'));
        out.push(h('hello', 'say hi  ·  hi · hey'));
        out.push(h('rm -rf /', 'permission denied — needs sudo.'));
        out.push(h('sudo rm -rf /', "really don't. full reboot."));
        out.push(blank());
        break;
      }
      out.push([s('cat: ' + args + ': No such file or directory', C.err)]);
      break;
    case 'pwd':
      out.push([s(`/home/${id.nick}/portfolio`, C.txt)]);
      break;
    case 'date':
      out.push([s(new Date().toString(), C.txt)]);
      break;
    case 'echo':
      out.push([s(args || ' ', C.txt)]);
      break;
    case 'exit':
    case 'gui':
    case 'quit':
    case 'scroll':
      out.push([s('leaving the terminal — opening the readable site...', C.dim)]);
      pushMany(out);
      T(() => exitTerminal(), 500);
      return;
    case 'top':
      out.push([s('scrolled to the top of the shell.', C.dim)]);
      pushMany(out);
      T(() => scrollShellTop(), 200);
      return;
    case 'history':
      state.hist.forEach((cmd2, i) => out.push([s('  ' + String(i + 1).padStart(3) + '  ', C.dim), s(cmd2, C.txt)]));
      if (!state.hist.length) out.push([s('history is empty. make some.', C.dim)]);
      break;
    case 'clear':
      state.lines = [];
      return;
    case 'sudo':
      if (/\brm\b/.test(args) && /(-rf|-fr|--force)/.test(args)) {
        rebootSequence();
        return;
      }
      out.push([s(`${id.nick} is not in the sudoers file. This incident will be reported.`, C.err)]);
      break;
    case 'rm':
      if (/(-rf|-fr|--force)/.test(cmd)) {
        out.push([s("rm: cannot remove '/': Operation not permitted", C.err)]);
        out.push([s('unauthorized — you need ', C.dim), s('sudo', C.acc), s(' for that.', C.dim)]);
        break;
      }
      out.push([s("rm: missing operand. (you probably want -rf, if you're feeling brave)", C.dim)]);
      break;
    case 'guess':
      state.mode = 'guess';
      state.secret = 1 + Math.floor(Math.random() * 100);
      state.guesses = 0;
      out.push([s("I'm thinking of a number between 1 and 100. guess, or 'q' to bail.", C.amb)]);
      break;
    case 'hello':
    case 'hi':
    case 'hey':
      out.push([s('hey. type ', C.txt), s('help', C.acc), s(' and make yourself at home.', C.txt)]);
      break;
    default:
      out.push([s('command not found: ' + name, C.err), s("  — type 'help'", C.dim)]);
  }
  pushMany(out);
}

// `sudo rm -rf /` — escalated rm: kernel panic, then actually replay the boot.
// The "restored from git" wink lands back in the TUI via enterTui (rebooting flag).
function rebootSequence() {
  T(() => push([s(`rm: recursively removing /home/${id.nick} ...`, C.amb)]), 200);
  T(() => push([s('removed projects/  ·  experience.json  ·  self_doubt.log', C.txt)]), 700);
  T(() => { state.lines = []; }, 1300);
  T(() => push([s('kernel panic: portfolio not found', C.err, 700)]), 1700);
  T(() => push([s('rebooting from git ...', C.dim)]), 2700);
  T(() => { rebooting = true; runBoot(); }, 3500);
}

function handleGuess(v: string) {
  if (v.toLowerCase() === 'q') {
    push([s('coward. the number was ' + state.secret + '.', C.dim)]);
    state.mode = 'shell';
    return;
  }
  const n = parseInt(v, 10);
  if (isNaN(n)) {
    push([s("numbers only. or 'q' to bail.", C.dim)]);
    return;
  }
  const g = state.guesses + 1;
  state.guesses = g;
  if (n === state.secret) {
    pushMany([
      [s('got it in ' + g + ' — the number was ' + state.secret + '.', C.acc, 500)],
      [s('binary search. I knew you were one of us.', C.dim)],
    ]);
    state.mode = 'shell';
  } else if (n < state.secret) {
    push([s('higher.', C.amb)]);
  } else {
    push([s('lower.', C.amb)]);
  }
}

// ---- file contents (syntax-highlighted preview) --------------------------
// Every file is built from props — zero hardcoded content.
function fileLines(name: string): Seg[][] {
  const L: Seg[][] = [];
  if (name === 'about.md') {
    L.push([s('# ', SY.com), s(id.name, SY.head, 700)]);
    L.push([]);
    L.push([s(props.about.lead, SY.txt)]);
    props.about.paragraphs.forEach((para) => {
      L.push([]);
      L.push([s(para, SY.txt)]);
    });
    L.push([]);
    // currently = most-recent role's company; previously = the rest (deduped).
    const companies = props.work.map((w) => w.company);
    const current = companies[0] || '';
    const previous = [...new Set(companies.slice(1).filter((c) => c !== current))];
    L.push([s('- ', SY.acc), s('currently   ', SY.head, 500), s(current, SY.txt)]);
    if (previous.length) L.push([s('- ', SY.acc), s('previously  ', SY.head, 500), s(previous.join(', '), SY.txt)]);
    L.push([s('- ', SY.acc), s('interests   ', SY.head, 500), s(props.about.interests.join(', '), SY.txt)]);
    L.push([s('- ', SY.acc), s('off-clock   ', SY.head, 500), s(props.about.hobbies.join(', '), SY.txt)]);
  } else if (name === 'experience.json') {
    const job = (role: string, company: string, period: string, impact: string, stack: string[], last: boolean) => {
      L.push([s('  {', SY.pun)]);
      L.push([s('    "role"', SY.key), s(': ', SY.pun), s('"' + role + '"', SY.str), s(',', SY.pun)]);
      L.push([s('    "company"', SY.key), s(': ', SY.pun), s('"' + company + '"', SY.str), s(',', SY.pun)]);
      L.push([s('    "period"', SY.key), s(': ', SY.pun), s('"' + period + '"', SY.str), s(',', SY.pun)]);
      L.push([s('    "impact"', SY.key), s(': ', SY.pun), s('"' + impact + '"', SY.str), s(',', SY.pun)]);
      const stk: Seg[] = [s('    "stack"', SY.key), s(': [', SY.pun)];
      stack.forEach((x, i) => {
        stk.push(s('"' + x + '"', SY.str));
        if (i < stack.length - 1) stk.push(s(', ', SY.pun));
      });
      stk.push(s(']', SY.pun));
      L.push(stk);
      L.push([s(last ? '  }' : '  },', SY.pun)]);
    };
    L.push([s('[', SY.pun)]);
    props.work.forEach((w, i) => job(w.role, w.company, w.period, w.summary, w.stack, i === props.work.length - 1));
    L.push([s(']', SY.pun)]);
  } else if (name === 'skills.ts') {
    const line = (key: string, items: string[]): Seg[] => {
      const o: Seg[] = [s('  ' + key, SY.key), s(': [', SY.pun)];
      items.forEach((it, i) => {
        o.push(s('"' + it + '"', SY.str));
        if (i < items.length - 1) o.push(s(', ', SY.pun));
      });
      o.push(s('],', SY.pun));
      return o;
    };
    const pad = Math.max(...props.skills.map((g) => g.label.replace('/', '').length));
    L.push([s('export const ', SY.kw), s('skills', SY.acc), s(' = {', SY.pun)]);
    props.skills.forEach((g) => L.push(line(g.label.replace('/', '').padEnd(pad), g.items)));
    L.push([s('};', SY.pun)]);
    L.push([]);
    L.push([s('// ', SY.com), s('spoken: ' + props.languages.map((l) => l.name + ' (' + l.level + ')').join(', '), SY.com)]);
  } else if (name === 'projects.md') {
    L.push([s('# ', SY.com), s('Projects', SY.head, 700)]);
    L.push([s('  ', SY.com), s('// pinned on github — synced at build', SY.com)]);
    props.projects.forEach((p) => {
      L.push([]);
      const head: Seg[] = [s('## ', SY.com), s(p.name, SY.acc, 600)];
      if (p.stars > 0) head.push(s('   ★ ' + p.stars, SY.dim));
      else if (p.pinned) head.push(s('   ◆ pinned', SY.dim));
      L.push(head);
      if (p.description) L.push([s(p.description, SY.txt)]);
      const tags = [p.language].filter(Boolean).join(' · ');
      if (tags) L.push([s(tags + '  ', SY.dim), s('→ ' + p.url.replace(/^https?:\/\//, ''), SY.dim)]);
      else L.push([s('→ ' + p.url.replace(/^https?:\/\//, ''), SY.dim)]);
    });
  } else if (name === 'contact.md') {
    L.push([s('# ', SY.com), s('Contact', SY.head, 700)]);
    L.push([]);
    L.push([s('email      ', SY.dim), s('run ', SY.com), s('email', SY.acc), s(' to reveal ✉', SY.com)]);
    L.push([s('github     ', SY.dim), s(githubShort, SY.txt)]);
    if (props.contact.linkedin) L.push([s('linkedin   ', SY.dim), s(props.contact.linkedin.replace(/^https?:\/\//, ''), SY.txt)]);
    L.push([s('phone      ', SY.dim), s('run ', SY.com), s('phone', SY.acc), s(' to reveal ☎', SY.com)]);
    L.push([]);
    L.push([s('// ', SY.com), s('open to roles in linux systems, web dev & security.', SY.com)]);
  }
  return L;
}

function meta(name: string): { glyph: string; icon: string; lang: string } {
  const ext = name.split('.').pop();
  if (ext === 'json') return { glyph: '{}', icon: '#cfe88f', lang: 'json' };
  if (ext === 'ts') return { glyph: 'TS', icon: '#33ff66', lang: 'typescript' };
  return { glyph: '#', icon: '#7ee0a3', lang: 'markdown' };
}

// ---- derived view values -------------------------------------------------
const activeFile = computed(() => files[state.selected] || files[0]);
const activeLines = computed(() => fileLines(activeFile.value));
const openMeta = computed(() => activeLines.value.length + ' lines · ' + meta(activeFile.value).lang);
const editorLines = computed(() => activeLines.value.map((segs, i) => ({ n: i + 1, segs })));

const fileRows = computed(() =>
  files.map((f, i) => {
    const m = meta(f);
    const on = i === state.selected;
    return {
      name: f,
      glyph: m.glyph,
      icon: m.icon,
      current: on,
      color: on ? '#d9ffe6' : '#7e9b84',
      bg: on ? 'rgba(51,255,102,0.10)' : 'transparent',
      bar: on ? '#33ff66' : 'transparent',
      open: () => {
        selectByIndex(i);
        focusActive();
      },
    };
  }),
);

// ---- mobile split-view: chip rails ---------------------------------------
// The file tree collapses to a horizontal chip rail using short labels
// (the desktop list shows full filenames; chips trade the extension for space).
const FILE_CHIP_LABELS: Record<string, string> = {
  'about.md': 'about',
  'experience.json': 'work',
  'skills.ts': 'skills',
  'projects.md': 'projects',
  'contact.md': 'contact',
};
const fileChips = computed(() =>
  files.map((f, i) => ({
    name: f,
    label: FILE_CHIP_LABELS[f] ?? f.replace(/\.[^.]+$/, ''),
    active: i === state.selected,
    open: () => {
      selectByIndex(i);
      focusActive();
    },
  })),
);

// Tap-to-run command bar under the shell. Phone keyboards are awkward, so the
// common commands are one tap away; `email` (absent from the file rail) surfaces
// the reveal-on-demand contact, and `exit` leaves for the readable site.
const cmdChips = ['help', 'ls', 'whoami', 'projects', 'skills', 'contact', 'email', 'date', 'guess', 'exit'];
function runCmd(cmd: string) {
  if (cmd.trim()) state.hist = state.hist.concat([cmd]);
  state.histIdx = -1;
  exec(cmd);
  focusActive();
}
</script>

<template>
  <!-- ===================== MOBILE: Split view (<768px) ===================== -->
  <!-- MOBILE BOOT -->
  <div
    v-if="isMobile && state.phase === 'boot'"
    @click="skipBoot"
    @keydown.enter.prevent="skipBoot"
    @keydown.space.prevent="skipBoot"
    role="button"
    tabindex="0"
    aria-label="Skip boot sequence"
    class="w-full h-full flex flex-col bg-card border border-edge-card rounded-[10px] overflow-hidden relative font-mono cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-acc shadow-[0_0_0_1px_rgba(51,255,102,0.05),0_24px_80px_rgba(0,0,0,0.6),0_0_140px_rgba(51,255,102,0.07)]"
  >
    <div ref="bootRef" class="flex-1 overflow-hidden px-[14px] py-[6px] text-[10.5px] leading-[1.7]">
      <div v-for="(line, i) in state.bootLines" :key="i" class="whitespace-pre-wrap break-words min-h-[1.7em]">
        <span v-for="(seg, j) in line.segs" :key="j" :style="{ color: seg.c, fontWeight: seg.w }">{{ seg.t }}</span>
      </div>
      <span class="inline-block w-[7px] h-[13px] bg-acc align-middle animate-blink"></span>
    </div>

    <div class="shrink-0 px-[14px] py-[8px] text-[10px] tracking-[0.04em] text-faint text-center">tap anywhere to skip →</div>

    <div
      class="pointer-events-none absolute inset-0 opacity-[0.32] bg-[repeating-linear-gradient(0deg,rgba(0,0,0,0.13)_0px,rgba(0,0,0,0.13)_1px,transparent_1px,transparent_3px)]"
    ></div>
    <div
      class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_62%,rgba(0,0,0,0.32)_100%)]"
    ></div>
  </div>

  <!-- MOBILE TUI -->
  <div
    v-else-if="isMobile"
    class="w-full h-full flex flex-col bg-card border border-edge-card rounded-[10px] overflow-hidden relative font-mono shadow-[0_0_0_1px_rgba(51,255,102,0.05),0_24px_80px_rgba(0,0,0,0.6),0_0_140px_rgba(51,255,102,0.07)]"
  >
    <!-- a) title bar -->
    <div class="flex items-center justify-between px-[16px] py-[9px] border-b border-edge-soft shrink-0">
      <span class="text-acc text-[12.5px] font-medium">{{ host }}</span>
      <span class="text-dim text-[10px] tracking-[0.08em]">tui · mobile</span>
    </div>

    <!-- b) file chip rail -->
    <div
      class="flex gap-[6px] px-[12px] py-[9px] overflow-x-auto border-b border-edge-soft shrink-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <button
        v-for="chip in fileChips"
        :key="chip.name"
        type="button"
        @click="chip.open"
        :aria-current="chip.active ? 'true' : undefined"
        class="shrink-0 whitespace-nowrap appearance-none cursor-pointer font-mono text-[11px] px-[11px] py-[5px] rounded-[6px] border focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-acc"
        :class="chip.active ? 'text-[#06140a] bg-acc border-acc' : 'text-grn2 bg-transparent border-edge-chip-strong'"
      >
        {{ chip.label }}
      </button>
    </div>

    <!-- c) viewer -->
    <div class="flex-[1.15] min-h-0 flex flex-col border-b border-edge-soft">
      <div class="flex items-baseline gap-[10px] px-[16px] pt-[8px] pb-[5px] shrink-0">
        <span class="text-grn2 text-[11px]">{{ activeFile }}</span>
        <span class="text-dim text-[10px]">{{ openMeta }}</span>
      </div>
      <div ref="previewRef" class="flex-1 overflow-auto pt-[2px] pb-[12px] text-[11px] leading-[1.72]">
        <div v-for="line in editorLines" :key="line.n" class="flex">
          <span class="flex-[0_0_34px] text-right pr-[12px] text-[#2f4636] select-none">{{ line.n }}</span>
          <span class="whitespace-pre-wrap break-words pr-[14px]">
            <span v-for="(seg, j) in line.segs" :key="j" :style="{ color: seg.c, fontWeight: seg.w }">{{ seg.t }}</span>
          </span>
        </div>
      </div>
    </div>

    <!-- d) shell -->
    <div class="flex-1 min-h-0 flex flex-col">
      <div class="px-[16px] py-[6px] shrink-0 text-[9.5px] tracking-[0.14em] text-dim border-b border-[#122016]">SHELL</div>
      <div
        ref="scrollA"
        @click="focusA"
        role="log"
        aria-live="polite"
        aria-label="terminal output"
        class="flex-1 overflow-y-auto px-[14px] pt-[9px] pb-[6px] text-[11.5px] leading-[1.6] cursor-text"
      >
        <div v-for="(line, i) in state.lines" :key="i" class="whitespace-pre-wrap break-words min-h-[1.6em]">
          <span v-for="(seg, j) in line.segs" :key="j" :style="{ color: seg.c, fontWeight: seg.w }">{{ seg.t }}</span>
        </div>
        <div class="flex items-baseline">
          <span class="text-acc font-medium">{{ host }}</span>
          <span class="text-dim">:</span>
          <span class="text-grn2">~</span>
          <span class="text-acc font-medium">$&nbsp;</span>
          <input
            ref="inputA"
            :value="state.input"
            @input="onInput"
            @keydown="onKey"
            spellcheck="false"
            autocomplete="off"
            placeholder="type or tap below"
            aria-label="terminal input"
            class="flex-1 min-w-0 bg-transparent border-none outline-none text-wht caret-acc p-0 font-mono text-[11.5px] leading-[1.6]"
          />
        </div>
      </div>

      <!-- command chip bar -->
      <div class="flex flex-wrap gap-[7px] px-[11px] py-[8px] border-t border-edge-soft shrink-0">
        <button
          v-for="c in cmdChips"
          :key="c"
          type="button"
          @click="runCmd(c)"
          class="appearance-none cursor-pointer whitespace-nowrap font-mono text-[11px] px-[11px] py-[6px] rounded-[7px] text-txt border border-edge-chip bg-[rgba(51,255,102,0.05)] focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-acc"
        >
          {{ c }}
        </button>
      </div>
    </div>

    <div
      class="pointer-events-none absolute inset-0 opacity-[0.32] bg-[repeating-linear-gradient(0deg,rgba(0,0,0,0.13)_0px,rgba(0,0,0,0.13)_1px,transparent_1px,transparent_3px)]"
    ></div>
    <div
      class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_62%,rgba(0,0,0,0.32)_100%)]"
    ></div>
  </div>

  <!-- ===================== DESKTOP: three-pane (≥768px) ===================== -->
  <!-- BOOT -->
  <div
    v-else-if="state.phase === 'boot'"
    @click="skipBoot"
    @keydown.enter.prevent="skipBoot"
    @keydown.space.prevent="skipBoot"
    role="button"
    tabindex="0"
    aria-label="Skip boot sequence"
    class="w-full h-full flex flex-col bg-card border border-edge-card rounded-[10px] overflow-hidden relative font-mono cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-acc shadow-[0_0_0_1px_rgba(51,255,102,0.05),0_24px_80px_rgba(0,0,0,0.6),0_0_140px_rgba(51,255,102,0.07)]"
  >
    <div class="flex items-center gap-2 px-[14px] py-[12px] bg-titlebar border-b border-edge-soft shrink-0">
      <span class="w-3 h-3 rounded-full" style="background: #ff5f56"></span>
      <span class="w-3 h-3 rounded-full" style="background: #ffbd2e"></span>
      <span class="w-3 h-3 rounded-full" style="background: #27c93f"></span>
      <div class="flex-1 min-w-0 truncate px-2 text-center text-dim text-[12px]">tty1 — power-on self test</div>
      <div class="w-[52px]"></div>
    </div>

    <div ref="bootRef" class="flex-1 overflow-hidden px-[22px] py-[20px] text-[13.5px] leading-[1.75]">
      <div v-for="(line, i) in state.bootLines" :key="i" class="whitespace-pre-wrap break-words min-h-[1.75em]">
        <span v-for="(seg, j) in line.segs" :key="j" :style="{ color: seg.c, fontWeight: seg.w }">{{ seg.t }}</span>
      </div>
      <span class="inline-block w-[9px] h-[16px] bg-acc align-middle animate-blink"></span>
    </div>

    <div class="shrink-0 px-[22px] py-[10px] text-[11.5px] text-faint text-right">press any key or click to skip →</div>

    <div
      class="pointer-events-none absolute inset-0 opacity-40 bg-[repeating-linear-gradient(0deg,rgba(0,0,0,0.14)_0px,rgba(0,0,0,0.14)_1px,transparent_1px,transparent_3px)]"
    ></div>
    <div
      class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.35)_100%)]"
    ></div>
  </div>

  <!-- TUI -->
  <div
    v-else
    class="w-full h-full flex flex-col bg-card border border-edge-card rounded-[10px] overflow-hidden relative font-mono shadow-[0_0_0_1px_rgba(51,255,102,0.05),0_24px_80px_rgba(0,0,0,0.6),0_0_140px_rgba(51,255,102,0.07)]"
  >
    <div class="flex items-center gap-2 px-[14px] py-[11px] bg-titlebar border-b border-edge-soft shrink-0">
      <span class="w-3 h-3 rounded-full" style="background: #ff5f56"></span>
      <span class="w-3 h-3 rounded-full" style="background: #ffbd2e"></span>
      <span class="w-3 h-3 rounded-full" style="background: #27c93f"></span>
      <div class="flex-1 min-w-0 truncate px-2 text-center text-dim text-[12px]">{{ host }} — tui — 100×38</div>
      <button
        type="button"
        @click="exitTerminal"
        class="shrink-0 whitespace-nowrap border border-edge-chip bg-transparent text-muted font-mono text-[11px] px-[10px] py-[4px] rounded-[5px] cursor-pointer transition-colors hover:border-acc hover:text-acc"
      >
        exit terminal ↗
      </button>
    </div>

    <!-- split: file tree + preview (stacks vertically on phones) -->
    <div class="flex-[1.25] flex flex-col sm:flex-row min-h-0 border-b border-edge-soft">
      <div class="w-full sm:w-[240px] shrink-0 border-b sm:border-b-0 sm:border-r border-edge-soft overflow-y-auto flex flex-col">
        <div class="px-[16px] pt-[12px] pb-[8px] text-[11px] tracking-[0.12em] text-dim">~/PORTFOLIO</div>
        <button
          v-for="row in fileRows"
          :key="row.name"
          type="button"
          @click="row.open"
          :aria-current="row.current ? 'true' : undefined"
          class="flex items-center gap-[9px] px-[16px] py-[6px] cursor-pointer text-[13px] w-full text-left bg-transparent font-mono appearance-none border-0 border-l-2 border-solid focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-acc"
          :style="{ color: row.color, background: row.bg, borderLeftColor: row.bar }"
        >
          <span class="text-[10px] font-bold w-[18px] shrink-0" :style="{ color: row.icon }">{{ row.glyph }}</span>{{ row.name }}
        </button>
        <div class="mt-auto px-[16px] py-[12px] text-[11px] text-[#3f5a47] border-t border-[#12201688]">
          ↑/↓ browse · click to open
        </div>
      </div>

      <div class="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
        <div class="flex gap-[14px] items-center px-[18px] py-[9px] border-b border-[#12201688] shrink-0 text-[12px]">
          <span class="text-grn2">{{ activeFile }}</span>
          <span class="text-dim">{{ openMeta }}</span>
        </div>
        <div ref="previewRef" class="flex-1 overflow-auto py-[12px] text-[13.5px] leading-[1.75]">
          <div v-for="line in editorLines" :key="line.n" class="flex">
            <span class="flex-[0_0_52px] text-right pr-[18px] text-[#2f4636] select-none">{{ line.n }}</span>
            <span class="whitespace-pre-wrap break-words pr-[18px]">
              <span v-for="(seg, j) in line.segs" :key="j" :style="{ color: seg.c, fontWeight: seg.w }">{{ seg.t }}</span>
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- shell -->
    <div class="flex-1 flex flex-col min-h-0">
      <div class="px-[18px] py-[7px] shrink-0 text-[11px] tracking-[0.1em] text-dim border-b border-[#12201688]">SHELL</div>
      <div
        ref="scrollA"
        @click="focusA"
        role="log"
        aria-live="polite"
        aria-label="terminal output"
        class="flex-1 overflow-y-auto px-[18px] pt-[12px] pb-[16px] text-[13.5px] leading-[1.7] cursor-text"
      >
        <div v-for="(line, i) in state.lines" :key="i" class="whitespace-pre-wrap break-words min-h-[1.7em]">
          <span v-for="(seg, j) in line.segs" :key="j" :style="{ color: seg.c, fontWeight: seg.w }">{{ seg.t }}</span>
        </div>
        <div class="flex items-baseline">
          <span class="text-acc font-medium">{{ host }}</span>
          <span class="text-dim">:</span>
          <span class="text-grn2">~</span>
          <span class="text-acc font-medium">$&nbsp;</span>
          <input
            ref="inputA"
            :value="state.input"
            @input="onInput"
            @keydown="onKey"
            spellcheck="false"
            autocomplete="off"
            aria-label="terminal input"
            class="flex-1 bg-transparent border-none outline-none text-wht caret-acc p-0 font-mono text-[13.5px] leading-[1.7]"
          />
        </div>
      </div>
    </div>

    <div
      class="pointer-events-none absolute inset-0 opacity-35 bg-[repeating-linear-gradient(0deg,rgba(0,0,0,0.13)_0px,rgba(0,0,0,0.13)_1px,transparent_1px,transparent_3px)]"
    ></div>
    <div
      class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_60%,rgba(0,0,0,0.3)_100%)]"
    ></div>
  </div>
</template>
