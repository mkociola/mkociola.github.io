/**
 * Pre-paint redirect guard for the landing page (`/`).
 *
 * Goal (per spec): real human visitors who hit `/` are sent to the `/TUI`
 * terminal experience; bots, crawlers, headless automation and no-JS clients
 * stay on `/`, which serves the fully readable "fallback" portfolio. That keeps
 * the site crawlable/indexable (all content lives on `/`) while giving humans
 * the interactive terminal.
 *
 * Anti-trap: the terminal's "exit terminal" action navigates to `/?gui=1`.
 * The `gui` flag (persisted to sessionStorage) suppresses the redirect so a
 * human who deliberately leaves the terminal is never bounced back into it.
 *
 * This runs as an inline, render-blocking <script> in <head> so the redirect
 * happens before first paint (no flash of the fallback page).
 *
 * Exported as a string so it can be injected verbatim via `set:html` and kept
 * as the single source of truth.
 */
export const BOT_GUARD_SOURCE = `(function () {
  try {
    var ua = (navigator.userAgent || "").toLowerCase();

    // Known non-human signatures: search/SEO crawlers, link unfurlers, social
    // bots, headless browsers, automation drivers and CLI HTTP clients.
    // Crawler-only tokens. Note: duckduckbot/baiduspider/discordbot/yandexbot/
    // petalbot/telegrambot are spelled out in full so their *human* in-app
    // browsers (DuckDuckGo, Baidu, Discord, Yandex…) are NOT misflagged as bots.
    var BOT = /bot|crawl|spider|slurp|mediapartners|adsbot|bingpreview|facebookexternalhit|facebot|ia_archiver|embedly|quora|outbrain|pinterest|slackbot|vkshare|whatsapp|flipboard|tumblr|bitlybot|skype|nuzzel|google-?read-?aloud|applebot|yandexbot|baiduspider|sogou|duckduckbot|discordbot|telegrambot|petalbot|semrush|ahrefs|mj12|dotbot|bytespider|gptbot|ccbot|claudebot|perplexity|chatgpt|anthropic|headless|phantom|puppeteer|playwright|selenium|lighthouse|wget|curl|python-requests|axios|go-http|java\\/|okhttp|node-fetch|libwww|httrack/i;

    var params = new URLSearchParams(location.search);
    var prefersGui = params.has("gui") || sessionStorage.getItem("prefers-gui") === "1";
    if (params.has("gui")) {
      try { sessionStorage.setItem("prefers-gui", "1"); } catch (e) {}
      // Keep the address bar clean/shareable — the preference lives in sessionStorage.
      try { history.replaceState(null, "", location.pathname + location.hash); } catch (e) {}
    }

    var isBot = !ua || navigator.webdriver === true || BOT.test(ua);

    if (!isBot && !prefersGui) {
      location.replace("/TUI");
    }
  } catch (e) {
    // On any failure, do nothing — the readable fallback at "/" is the safe default.
  }
})();`;
