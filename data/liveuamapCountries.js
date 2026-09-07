// ---------------------------------------------------------------
// LIVEUAMAP COUNTRY DATASET
//
// Data only — no UI, no search logic. Consumed by:
//   - lib/liveuamapSearch.js  (the pure fuzzy-search function)
//   - lib/liveuamapExplorer.js (the "World Map" tab UI)
//   - scripts/verifyLiveuamapCountries.js (re-checks every subdomain)
//
// Each entry maps a country/region to its Liveuamap subdomain:
//   { name, slug, aliases[], arabicName?, flag?, verified }
//   -> https://<slug>.liveuamap.com/
//
// verified:
//   Liveuamap only covers ~30+ regions/conflict zones, NOT every country.
//   `verified: true` means the subdomain was confirmed to resolve to a real,
//   distinct Liveuamap page (HTTP 200, final host *.liveuamap.com, has <title>).
//   The list below was verified on 2026-09-07 with scripts/verifyLiveuamapCountries.js.
//   Only `verified: true` entries are searchable/selectable in the UI, so an
//   unverified slug can never produce a dead link.
//
//   ==> When adding a country: append a one-line object with `verified: false`,
//       then run `node scripts/verifyLiveuamapCountries.js` and only flip it to
//       true if the script confirms it. No other file needs to change.
// ---------------------------------------------------------------
(function (root, factory) {
  var data = factory();
  if (typeof module === "object" && module.exports) module.exports = data;
  else root.LIVEUAMAP_COUNTRIES = data;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  return [
    // --- Eastern Europe / post-Soviet -----------------------------------
    { name: "Ukraine", slug: "ukraine", aliases: ["ukr", "ua", "украина", "україна"], arabicName: "أوكرانيا", flag: "🇺🇦", verified: true },
    { name: "Russia", slug: "russia", aliases: ["rus", "ru", "rf", "россия"], arabicName: "روسيا", flag: "🇷🇺", verified: true },
    { name: "Belarus", slug: "belarus", aliases: ["bel", "by", "беларусь"], arabicName: "بيلاروسيا", flag: "🇧🇾", verified: true },
    { name: "Moldova", slug: "moldova", aliases: ["mda", "md", "transnistria", "молдова"], arabicName: "مولدوفا", flag: "🇲🇩", verified: true },
    { name: "Georgia", slug: "georgia", aliases: ["geo", "ge", "sakartvelo", "abkhazia", "south ossetia"], arabicName: "جورجيا", flag: "🇬🇪", verified: true },
    { name: "Balkans", slug: "balkans", aliases: ["balkan", "serbia", "kosovo", "bosnia", "southeastern europe"], flag: "🗺️", verified: true },

    // --- Middle East --------------------------------------------------------
    { name: "Israel–Palestine", slug: "israelpalestine", aliases: ["israel", "palestine", "gaza", "west bank", "isr", "il", "ps", "فلسطين", "إسرائيل", "غزة"], arabicName: "فلسطين", flag: "🇵🇸", verified: true },
    { name: "Syria", slug: "syria", aliases: ["syr", "sy", "سوريا", "سوريه"], arabicName: "سوريا", flag: "🇸🇾", verified: true },
    { name: "Lebanon", slug: "lebanon", aliases: ["leb", "lb", "lubnan", "لبنان"], arabicName: "لبنان", flag: "🇱🇧", verified: true },
    { name: "Iran", slug: "iran", aliases: ["irn", "ir", "persia", "إيران", "ايران"], arabicName: "إيران", flag: "🇮🇷", verified: true },
    { name: "Iraq", slug: "iraq", aliases: ["irq", "iq", "العراق", "عراق"], arabicName: "العراق", flag: "🇮🇶", verified: true },
    { name: "Yemen", slug: "yemen", aliases: ["yem", "ye", "اليمن", "يمن"], arabicName: "اليمن", flag: "🇾🇪", verified: true },
    { name: "Saudi Arabia", slug: "saudiarabia", aliases: ["ksa", "sa", "saudi", "السعودية", "السعوديه"], arabicName: "السعودية", flag: "🇸🇦", verified: true },
    { name: "Turkey", slug: "turkey", aliases: ["tur", "tr", "turkiye", "türkiye", "تركيا"], arabicName: "تركيا", flag: "🇹🇷", verified: true },

    // --- North Africa ----------------------------------------------------
    { name: "Egypt", slug: "egypt", aliases: ["egy", "egyp", "eg", "egyptian", "مصر", "مصر‎"], arabicName: "مصر", flag: "🇪🇬", verified: true },
    { name: "Libya", slug: "libya", aliases: ["lby", "ly", "ليبيا", "ليبيه"], arabicName: "ليبيا", flag: "🇱🇾", verified: true },
    { name: "Tunisia", slug: "tunisia", aliases: ["tun", "tn", "تونس"], arabicName: "تونس", flag: "🇹🇳", verified: true },
    { name: "Algeria", slug: "algeria", aliases: ["dza", "dz", "alg", "الجزائر"], arabicName: "الجزائر", flag: "🇩🇿", verified: true },
    { name: "Sudan", slug: "sudan", aliases: ["sdn", "sd", "السودان", "سودان"], arabicName: "السودان", flag: "🇸🇩", verified: true },

    // --- Sub-Saharan Africa ---------------------------------------------
    { name: "Sahel", slug: "sahel", aliases: ["mali", "niger", "burkina faso", "west africa"], flag: "🗺️", verified: true },
    { name: "Nigeria", slug: "nigeria", aliases: ["nga", "ng", "نيجيريا"], arabicName: "نيجيريا", flag: "🇳🇬", verified: true },
    { name: "Somalia", slug: "somalia", aliases: ["som", "so", "الصومال"], arabicName: "الصومال", flag: "🇸🇴", verified: true },
    { name: "Ethiopia", slug: "ethiopia", aliases: ["eth", "et", "tigray", "إثيوبيا"], arabicName: "إثيوبيا", flag: "🇪🇹", verified: true },

    // --- Asia ----------------------------------------------------------
    { name: "Afghanistan", slug: "afghanistan", aliases: ["afg", "af", "afghan", "أفغانستان"], arabicName: "أفغانستان", flag: "🇦🇫", verified: true },
    { name: "Kashmir", slug: "kashmir", aliases: ["jammu", "india pakistan", "indo-pak", "كشمير"], flag: "🗺️", verified: true },
    { name: "Myanmar", slug: "myanmar", aliases: ["mmr", "mm", "burma", "rohingya", "ميانمار"], arabicName: "ميانمار", flag: "🇲🇲", verified: true },
    { name: "Taiwan", slug: "taiwan", aliases: ["twn", "tw", "roc", "تايوان"], arabicName: "تايوان", flag: "🇹🇼", verified: true },
    { name: "Korean Peninsula", slug: "koreas", aliases: ["korea", "north korea", "south korea", "dprk", "nk", "sk", "كوريا"], flag: "🗺️", verified: true },

    // --- Americas ------------------------------------------------------
    { name: "Venezuela", slug: "venezuela", aliases: ["ven", "ve", "فنزويلا"], arabicName: "فنزويلا", flag: "🇻🇪", verified: true },
    { name: "Colombia", slug: "colombia", aliases: ["col", "co", "كولومبيا"], arabicName: "كولومبيا", flag: "🇨🇴", verified: true },
    { name: "Mexico", slug: "mexico", aliases: ["mex", "mx", "méxico", "المكسيك"], arabicName: "المكسيك", flag: "🇲🇽", verified: true },
    { name: "Caribbean", slug: "caribbean", aliases: ["haiti", "hti", "ht", "هايتي", "الكاريبي"], flag: "🗺️", verified: true },

    // --- Known regions WITHOUT a Liveuamap subdomain --------------------
    // Kept here so the UI can say "not covered by Liveuamap" instead of
    // silently failing. `verified: false` -> excluded from search/selection.
    { name: "Morocco", slug: "morocco", aliases: ["mar", "ma", "المغرب"], arabicName: "المغرب", flag: "🇲🇦", verified: false },
    { name: "Jordan", slug: "jordan", aliases: ["jor", "jo", "الأردن"], arabicName: "الأردن", flag: "🇯🇴", verified: false },
  ];
});
