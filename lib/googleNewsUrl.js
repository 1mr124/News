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

  // ---------------------------------------------------------------
  // EDITION MATRIX QUIRK  (verified 2026-09-10 by following
  // news.google.com/home?hl=..&gl=..&ceid=.. redirects for every country
  // in data/googleNewsCountries.js)
  //
  // Google News only publishes a fixed set of (language, region) editions.
  // Ask for a pair it doesn't publish and it silently 301-redirects to the
  // default edition for that language (hl=ar -> gl=EG, hl=en -> gl=US, ...)
  // and serves it with HTTP 200 — no error. So requesting the app's default
  // hl=ar for, say, Russia quietly returns the Egypt edition.
  //
  // Fix: only when the resolved hl would be "ar" AND the country has no
  // Arabic edition, substitute the hl Google actually honors for that gl.
  // Everything else (explicit non-Arabic language picks, the 4 real Arabic
  // editions) is left untouched.
  // ---------------------------------------------------------------

  // The only countries with a real hl=ar Google News edition.
  var ARABIC_EDITIONS = { EG: 1, SA: 1, AE: 1, LB: 1 };

  // gl -> hl that Google News verifiably honors for that region. Applied
  // only in place of a would-be hl=ar. Group B = a native-language edition
  // exists; Group C non-Arab countries (IR/AF/BY/GE/MM/SO) have no edition
  // at all, so these are the least-misleading language for each.
  var EDITION_HL = {
    // Group B — native-language edition, gl preserved
    IL: "he", TR: "tr", NG: "en", ET: "en", KE: "en", ZA: "en", GB: "en",
    IE: "en", FR: "fr", DE: "de", IT: "it", ES: "es", NL: "nl", PL: "pl",
    GR: "el", SE: "sv", UA: "uk", RU: "ru", US: "en", CA: "en", MX: "es",
    BR: "pt-BR", AR: "es", CO: "es", VE: "es", CL: "es", IN: "en", PK: "en",
    CN: "zh-CN", JP: "ja", KR: "ko", ID: "id", BD: "bn", PH: "en", VN: "vi",
    TH: "th", MY: "ms", TW: "zh-TW", AU: "en", NZ: "en", MA: "fr",
    // Group C — no Google News edition in any language; least-wrong hl
    IR: "fa", AF: "fa", BY: "ru", GE: "en", MM: "en", SO: "en",
  };

  // Countries Google News has no dedicated edition for (any language). The
  // UI shows an explanatory note for these; the 13 Arab-League members here
  // stay on hl=ar (they redirect to the Arabic Egypt edition, still Arabic).
  var NO_EDITION = {
    QA: 1, KW: 1, BH: 1, OM: 1, JO: 1, SY: 1, IQ: 1, PS: 1, YE: 1, LY: 1,
    TN: 1, DZ: 1, SD: 1, IR: 1, SO: 1, BY: 1, GE: 1, AF: 1, MM: 1,
  };

  // Display names for every hl that can appear (LANGS + EDITION_HL values).
  var HL_LABEL = {
    ar: "العربية", en: "English", fr: "Français", es: "Español",
    de: "Deutsch", it: "Italiano", nl: "Nederlands", pl: "Polski",
    el: "Ελληνικά", sv: "Svenska", tr: "Türkçe", he: "עברית", fa: "فارسی",
    ru: "Русский", uk: "Українська", "pt-BR": "Português", "zh-CN": "中文 (简体)",
    "zh-TW": "中文 (繁體)", ja: "日本語", ko: "한국어", id: "Bahasa Indonesia",
    bn: "বাংলা", vi: "Tiếng Việt", th: "ไทย", ms: "Bahasa Melayu",
  };
  function hlLabel(hl) { return HL_LABEL[hl] || hl; }

  function isLang(code) {
    for (var i = 0; i < LANGS.length; i++) if (LANGS[i].code === code) return true;
    return false;
  }
  function isTopic(id) {
    for (var i = 0; i < TOPICS.length; i++) if (TOPICS[i].id === id) return true;
    return false;
  }

  // The hl build() will actually use for this country: the requested one,
  // unless it's a would-be hl=ar for a country with no Arabic edition, in
  // which case the hl Google honors for that gl (see EDITION_HL).
  function resolveHl(code, lang) {
    var gl = String(code || DEFAULT_CODE).toUpperCase();
    var hl = isLang(lang) ? lang : "en";
    if (hl === "ar" && !ARABIC_EDITIONS[gl] && EDITION_HL[gl]) return EDITION_HL[gl];
    return hl;
  }

  // "" when build() reaches the edition the user asked for; otherwise a
  // short sentence the UI can show explaining what it will actually open.
  function editionNote(code, lang) {
    var gl = String(code || DEFAULT_CODE).toUpperCase();
    if (ARABIC_EDITIONS[gl]) return "";
    var reqHl = isLang(lang) ? lang : "en";
    var hl = resolveHl(gl, lang);
    if (NO_EDITION[gl]) {
      return "Google News has no dedicated edition for this country. Showing its " +
        hlLabel(hl) + " edition instead.";
    }
    if (hl !== reqHl) {
      return "Google News has no " + hlLabel(reqHl) + " edition for this country. Showing its " +
        hlLabel(hl) + " edition.";
    }
    return "";
  }

  // country/edition + language -> the hl/gl/ceid triple Google News uses
  // everywhere (e.g. hl=ar&gl=EG&ceid=EG:ar).
  function editionParams(code, lang) {
    var gl = String(code || DEFAULT_CODE).toUpperCase();
    var hl = resolveHl(gl, lang);
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
    resolveHl: resolveHl,
    editionNote: editionNote,
    hlLabel: hlLabel,
  };
});
