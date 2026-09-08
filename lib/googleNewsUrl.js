// ---------------------------------------------------------------
// GOOGLE NEWS URL BUILDER  (pure, framework-agnostic)
//
// Google News can't be embedded (news.google.com sends
// `X-Frame-Options: SAMEORIGIN`, verified 2026-09-08 on /, /home, /search,
// /topics/*). This project does NOT proxy or bypass that — instead it
// constructs the right Google News URL and opens it in a new tab.
//
// Exposes:
//   GoogleNewsUrl.TOPICS   - [{ id, label }]  section list for the UI
//   GoogleNewsUrl.LANGS    - [{ code, label }] language list for the UI
//   GoogleNewsUrl.build({ code, lang, topic, query }) -> URL string
//
// No DOM, no network. Kept out of the UI component so it's independently
// testable (see scripts/googleNewsUrl.test.js).
// ---------------------------------------------------------------
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.GoogleNewsUrl = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var BASE = "https://news.google.com";

  // Section list. "top" -> the /home feed; every other id is a Google News
  // topic name understood by /headlines/section/topic/<ID>, which Google
  // 301-redirects to the current localized /topics/<opaque-token> — so we
  // never hardcode a rotating token. Verified 200 for all of these under
  // hl=ar&gl=EG and hl=en&gl=US (2026-09-08).
  var TOPICS = [
    { id: "top", label: "Top Stories" },
    { id: "WORLD", label: "World" },
    { id: "NATION", label: "Nation" },
    { id: "POLITICS", label: "Politics" },
    { id: "BUSINESS", label: "Business" },
    { id: "TECHNOLOGY", label: "Technology" },
    { id: "SCIENCE", label: "Science" },
    { id: "HEALTH", label: "Health" },
    { id: "ENTERTAINMENT", label: "Entertainment" },
    { id: "SPORTS", label: "Sports" },
  ];

  // Google News `hl` (UI + article language). Arabic is the default here to
  // match the rest of the app (the World Map tab also defaults to Arabic).
  var LANGS = [
    { code: "ar", label: "العربية" },
    { code: "en", label: "English" },
    { code: "fr", label: "Français" },
    { code: "es", label: "Español" },
    { code: "de", label: "Deutsch" },
    { code: "tr", label: "Türkçe" },
    { code: "fa", label: "فارسی" },
    { code: "he", label: "עברית" },
    { code: "ru", label: "Русский" },
  ];

  var DEFAULT_LANG = "ar";
  var DEFAULT_CODE = "US";

  function isLang(code) {
    for (var i = 0; i < LANGS.length; i++) if (LANGS[i].code === code) return true;
    return false;
  }
  function isTopic(id) {
    for (var i = 0; i < TOPICS.length; i++) if (TOPICS[i].id === id) return true;
    return false;
  }

  // country/edition + language -> the hl/gl/ceid triple Google News uses
  // everywhere (e.g. hl=ar&gl=EG&ceid=EG:ar).
  function editionParams(code, lang) {
    var gl = String(code || DEFAULT_CODE).toUpperCase();
    var hl = isLang(lang) ? lang : "en";
    return (
      "hl=" + encodeURIComponent(hl) +
      "&gl=" + encodeURIComponent(gl) +
      "&ceid=" + encodeURIComponent(gl + ":" + hl)
    );
  }

  // build({ code, lang, topic, query }) -> Google News URL string.
  //   - a non-empty query -> /search   (a custom search always wins over the topic)
  //   - topic "top" / missing / unknown -> /home
  //   - any other known topic -> /headlines/section/topic/<ID>
  function build(opts) {
    opts = opts || {};
    var params = editionParams(opts.code, opts.lang);
    var query = (opts.query == null ? "" : String(opts.query)).trim();
    if (query) {
      return BASE + "/search?q=" + encodeURIComponent(query) + "&" + params;
    }
    var topic = opts.topic;
    if (!topic || topic === "top" || !isTopic(topic)) {
      return BASE + "/home?" + params;
    }
    return BASE + "/headlines/section/topic/" + topic + "?" + params;
  }

  return {
    BASE: BASE,
    TOPICS: TOPICS,
    LANGS: LANGS,
    DEFAULT_LANG: DEFAULT_LANG,
    DEFAULT_CODE: DEFAULT_CODE,
    isLang: isLang,
    isTopic: isTopic,
    build: build,
  };
});
