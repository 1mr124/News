// ---------------------------------------------------------------
// GOOGLE NEWS COUNTRY / EDITION DATASET
//
// Data only — no UI, no search logic. Consumed by:
//   - lib/liveuamapSearch.js   (the pure fuzzy-search fn is reused as-is)
//   - lib/googleNewsExplorer.js (the "Google News" tab UI)
//
// Each entry maps a country to its Google News "edition" (the gl / ceid
// query params), keyed by ISO 3166-1 alpha-2 code:
//   { name, code, slug, aliases[], arabicName?, flag?, luSlug?, verified }
//
// Field notes:
//   code    - ISO 3166-1 alpha-2, UPPER-CASE. Goes into gl=<code> and
//             ceid=<code>:<lang> in the Google News URL.
//   slug    - code.toLowerCase(). Also doubles as a short search alias, and
//             is the field name lib/liveuamapSearch.js expects, so the pure
//             search fn works on this dataset unchanged.
//   aliases - English abbreviations, ISO3, common alt names / misspellings,
//             and native (incl. Arabic) names. Used by the fuzzy search.
//   luSlug  - OPTIONAL. The matching slug in data/liveuamapCountries.js, set
//             only where Liveuamap actually covers the country. Present ->
//             the "Open in World Map" cross-link shows; absent -> it hides.
//   verified - always true here (every valid ISO code has a Google News
//             edition). Kept so lib/liveuamapSearch.js (which skips
//             verified !== true) accepts these entries.
//
//   ==> To add a country: append a one-line object. `slug` must be the
//       lower-cased `code`. No other file needs to change.
// ---------------------------------------------------------------
(function (root, factory) {
  var data = factory();
  if (typeof module === "object" && module.exports) module.exports = data;
  else root.GOOGLE_NEWS_COUNTRIES = data;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  return [
    // --- Arab world ---------------------------------------------------------
    { name: "Egypt", code: "EG", slug: "eg", aliases: ["egy", "egyp", "egyptian", "مصر"], arabicName: "مصر", flag: "🇪🇬", luSlug: "egypt", verified: true },
    { name: "Saudi Arabia", code: "SA", slug: "sa", aliases: ["ksa", "saudi", "saudia", "السعودية", "السعوديه"], arabicName: "السعودية", flag: "🇸🇦", luSlug: "saudiarabia", verified: true },
    { name: "United Arab Emirates", code: "AE", slug: "ae", aliases: ["uae", "emirates", "dubai", "abu dhabi", "الإمارات", "الامارات"], arabicName: "الإمارات", flag: "🇦🇪", verified: true },
    { name: "Qatar", code: "QA", slug: "qa", aliases: ["qat", "doha", "قطر"], arabicName: "قطر", flag: "🇶🇦", verified: true },
    { name: "Kuwait", code: "KW", slug: "kw", aliases: ["kwt", "الكويت"], arabicName: "الكويت", flag: "🇰🇼", verified: true },
    { name: "Bahrain", code: "BH", slug: "bh", aliases: ["bhr", "manama", "البحرين"], arabicName: "البحرين", flag: "🇧🇭", verified: true },
    { name: "Oman", code: "OM", slug: "om", aliases: ["omn", "muscat", "عمان", "عُمان", "سلطنة عمان"], arabicName: "عُمان", flag: "🇴🇲", verified: true },
    { name: "Jordan", code: "JO", slug: "jo", aliases: ["jor", "amman", "الأردن", "الاردن"], arabicName: "الأردن", flag: "🇯🇴", verified: true },
    { name: "Lebanon", code: "LB", slug: "lb", aliases: ["leb", "lbn", "beirut", "لبنان"], arabicName: "لبنان", flag: "🇱🇧", luSlug: "lebanon", verified: true },
    { name: "Syria", code: "SY", slug: "sy", aliases: ["syr", "damascus", "سوريا", "سوريه"], arabicName: "سوريا", flag: "🇸🇾", luSlug: "syria", verified: true },
    { name: "Iraq", code: "IQ", slug: "iq", aliases: ["irq", "baghdad", "العراق", "عراق"], arabicName: "العراق", flag: "🇮🇶", luSlug: "iraq", verified: true },
    { name: "Palestine", code: "PS", slug: "ps", aliases: ["palestinian", "gaza", "west bank", "فلسطين"], arabicName: "فلسطين", flag: "🇵🇸", luSlug: "israelpalestine", verified: true },
    { name: "Yemen", code: "YE", slug: "ye", aliases: ["yem", "sanaa", "اليمن", "يمن"], arabicName: "اليمن", flag: "🇾🇪", luSlug: "yemen", verified: true },
    { name: "Libya", code: "LY", slug: "ly", aliases: ["lby", "tripoli", "ليبيا", "ليبيه"], arabicName: "ليبيا", flag: "🇱🇾", luSlug: "libya", verified: true },
    { name: "Tunisia", code: "TN", slug: "tn", aliases: ["tun", "tunis", "تونس"], arabicName: "تونس", flag: "🇹🇳", luSlug: "tunisia", verified: true },
    { name: "Algeria", code: "DZ", slug: "dz", aliases: ["dza", "alg", "algiers", "الجزائر"], arabicName: "الجزائر", flag: "🇩🇿", luSlug: "algeria", verified: true },
    { name: "Morocco", code: "MA", slug: "ma", aliases: ["mar", "mor", "rabat", "casablanca", "المغرب"], arabicName: "المغرب", flag: "🇲🇦", verified: true },
    { name: "Sudan", code: "SD", slug: "sd", aliases: ["sdn", "khartoum", "السودان", "سودان"], arabicName: "السودان", flag: "🇸🇩", luSlug: "sudan", verified: true },

    // --- Rest of the Middle East -----------------------------------------
    { name: "Israel", code: "IL", slug: "il", aliases: ["isr", "israeli", "tel aviv", "jerusalem", "إسرائيل", "اسرائيل"], arabicName: "إسرائيل", flag: "🇮🇱", luSlug: "israelpalestine", verified: true },
    { name: "Iran", code: "IR", slug: "ir", aliases: ["irn", "persia", "tehran", "إيران", "ايران"], arabicName: "إيران", flag: "🇮🇷", luSlug: "iran", verified: true },
    { name: "Turkey", code: "TR", slug: "tr", aliases: ["tur", "turkiye", "türkiye", "ankara", "istanbul", "تركيا"], arabicName: "تركيا", flag: "🇹🇷", luSlug: "turkey", verified: true },

    // --- Africa ---------------------------------------------------------
    { name: "Nigeria", code: "NG", slug: "ng", aliases: ["nga", "lagos", "abuja", "نيجيريا"], arabicName: "نيجيريا", flag: "🇳🇬", luSlug: "nigeria", verified: true },
    { name: "Ethiopia", code: "ET", slug: "et", aliases: ["eth", "addis ababa", "tigray", "إثيوبيا", "اثيوبيا"], arabicName: "إثيوبيا", flag: "🇪🇹", luSlug: "ethiopia", verified: true },
    { name: "Kenya", code: "KE", slug: "ke", aliases: ["ken", "nairobi", "كينيا"], arabicName: "كينيا", flag: "🇰🇪", verified: true },
    { name: "South Africa", code: "ZA", slug: "za", aliases: ["rsa", "zaf", "johannesburg", "cape town", "جنوب أفريقيا", "جنوب افريقيا"], arabicName: "جنوب أفريقيا", flag: "🇿🇦", verified: true },
    { name: "Somalia", code: "SO", slug: "so", aliases: ["som", "mogadishu", "الصومال"], arabicName: "الصومال", flag: "🇸🇴", luSlug: "somalia", verified: true },

    // --- Europe -------------------------------------------------------
    { name: "United Kingdom", code: "GB", slug: "gb", aliases: ["uk", "gbr", "britain", "great britain", "england", "london", "المملكة المتحدة", "بريطانيا"], arabicName: "المملكة المتحدة", flag: "🇬🇧", verified: true },
    { name: "Ireland", code: "IE", slug: "ie", aliases: ["irl", "eire", "dublin", "أيرلندا", "ايرلندا"], arabicName: "أيرلندا", flag: "🇮🇪", verified: true },
    { name: "France", code: "FR", slug: "fr", aliases: ["fra", "paris", "french", "فرنسا"], arabicName: "فرنسا", flag: "🇫🇷", verified: true },
    { name: "Germany", code: "DE", slug: "de", aliases: ["deu", "ger", "deutschland", "berlin", "ألمانيا", "المانيا"], arabicName: "ألمانيا", flag: "🇩🇪", verified: true },
    { name: "Italy", code: "IT", slug: "it", aliases: ["ita", "italia", "rome", "إيطاليا", "ايطاليا"], arabicName: "إيطاليا", flag: "🇮🇹", verified: true },
    { name: "Spain", code: "ES", slug: "es", aliases: ["esp", "espana", "españa", "madrid", "إسبانيا", "اسبانيا"], arabicName: "إسبانيا", flag: "🇪🇸", verified: true },
    { name: "Netherlands", code: "NL", slug: "nl", aliases: ["nld", "holland", "amsterdam", "dutch", "هولندا"], arabicName: "هولندا", flag: "🇳🇱", verified: true },
    { name: "Poland", code: "PL", slug: "pl", aliases: ["pol", "polska", "warsaw", "بولندا", "بولونيا"], arabicName: "بولندا", flag: "🇵🇱", verified: true },
    { name: "Greece", code: "GR", slug: "gr", aliases: ["grc", "hellas", "athens", "اليونان"], arabicName: "اليونان", flag: "🇬🇷", verified: true },
    { name: "Sweden", code: "SE", slug: "se", aliases: ["swe", "stockholm", "السويد"], arabicName: "السويد", flag: "🇸🇪", verified: true },
    { name: "Ukraine", code: "UA", slug: "ua", aliases: ["ukr", "kyiv", "kiev", "أوكرانيا", "اوكرانيا"], arabicName: "أوكرانيا", flag: "🇺🇦", luSlug: "ukraine", verified: true },
    { name: "Russia", code: "RU", slug: "ru", aliases: ["rus", "russian federation", "moscow", "روسيا"], arabicName: "روسيا", flag: "🇷🇺", luSlug: "russia", verified: true },
    { name: "Belarus", code: "BY", slug: "by", aliases: ["blr", "minsk", "بيلاروسيا", "روسيا البيضاء"], arabicName: "بيلاروسيا", flag: "🇧🇾", luSlug: "belarus", verified: true },
    { name: "Georgia", code: "GE", slug: "ge", aliases: ["geo", "tbilisi", "sakartvelo", "جورجيا"], arabicName: "جورجيا", flag: "🇬🇪", luSlug: "georgia", verified: true },

    // --- Americas ---------------------------------------------------
    { name: "United States", code: "US", slug: "us", aliases: ["usa", "u.s.", "u.s.a.", "america", "united states of america", "washington", "الولايات المتحدة", "امريكا", "أمريكا"], arabicName: "الولايات المتحدة", flag: "🇺🇸", verified: true },
    { name: "Canada", code: "CA", slug: "ca", aliases: ["can", "ottawa", "toronto", "كندا"], arabicName: "كندا", flag: "🇨🇦", verified: true },
    { name: "Mexico", code: "MX", slug: "mx", aliases: ["mex", "méxico", "mexico city", "المكسيك"], arabicName: "المكسيك", flag: "🇲🇽", luSlug: "mexico", verified: true },
    { name: "Brazil", code: "BR", slug: "br", aliases: ["bra", "brasil", "brasilia", "sao paulo", "البرازيل"], arabicName: "البرازيل", flag: "🇧🇷", verified: true },
    { name: "Argentina", code: "AR", slug: "ar", aliases: ["arg", "buenos aires", "الأرجنتين", "الارجنتين"], arabicName: "الأرجنتين", flag: "🇦🇷", verified: true },
    { name: "Colombia", code: "CO", slug: "co", aliases: ["col", "bogota", "bogotá", "كولومبيا"], arabicName: "كولومبيا", flag: "🇨🇴", luSlug: "colombia", verified: true },
    { name: "Venezuela", code: "VE", slug: "ve", aliases: ["ven", "caracas", "فنزويلا"], arabicName: "فنزويلا", flag: "🇻🇪", luSlug: "venezuela", verified: true },
    { name: "Chile", code: "CL", slug: "cl", aliases: ["chl", "santiago", "تشيلي", "شيلي"], arabicName: "تشيلي", flag: "🇨🇱", verified: true },

    // --- Asia-Pacific ---------------------------------------------
    { name: "India", code: "IN", slug: "in", aliases: ["ind", "bharat", "new delhi", "delhi", "mumbai", "الهند"], arabicName: "الهند", flag: "🇮🇳", verified: true },
    { name: "Pakistan", code: "PK", slug: "pk", aliases: ["pak", "islamabad", "karachi", "باكستان", "الباكستان"], arabicName: "باكستان", flag: "🇵🇰", verified: true },
    { name: "China", code: "CN", slug: "cn", aliases: ["chn", "prc", "beijing", "peking", "shanghai", "الصين"], arabicName: "الصين", flag: "🇨🇳", verified: true },
    { name: "Japan", code: "JP", slug: "jp", aliases: ["jpn", "nippon", "tokyo", "اليابان"], arabicName: "اليابان", flag: "🇯🇵", verified: true },
    { name: "South Korea", code: "KR", slug: "kr", aliases: ["kor", "korea", "rok", "seoul", "كوريا الجنوبية", "كوريا"], arabicName: "كوريا الجنوبية", flag: "🇰🇷", luSlug: "koreas", verified: true },
    { name: "Indonesia", code: "ID", slug: "id", aliases: ["idn", "jakarta", "إندونيسيا", "اندونيسيا"], arabicName: "إندونيسيا", flag: "🇮🇩", verified: true },
    { name: "Bangladesh", code: "BD", slug: "bd", aliases: ["bgd", "dhaka", "بنغلاديش", "بنجلاديش"], arabicName: "بنغلاديش", flag: "🇧🇩", verified: true },
    { name: "Philippines", code: "PH", slug: "ph", aliases: ["phl", "manila", "pinoy", "الفلبين"], arabicName: "الفلبين", flag: "🇵🇭", verified: true },
    { name: "Vietnam", code: "VN", slug: "vn", aliases: ["vnm", "viet nam", "hanoi", "فيتنام"], arabicName: "فيتنام", flag: "🇻🇳", verified: true },
    { name: "Thailand", code: "TH", slug: "th", aliases: ["tha", "siam", "bangkok", "تايلاند", "تايلند"], arabicName: "تايلاند", flag: "🇹🇭", verified: true },
    { name: "Malaysia", code: "MY", slug: "my", aliases: ["mys", "kuala lumpur", "ماليزيا"], arabicName: "ماليزيا", flag: "🇲🇾", verified: true },
    { name: "Afghanistan", code: "AF", slug: "af", aliases: ["afg", "afghan", "kabul", "أفغانستان", "افغانستان"], arabicName: "أفغانستان", flag: "🇦🇫", luSlug: "afghanistan", verified: true },
    { name: "Taiwan", code: "TW", slug: "tw", aliases: ["twn", "roc", "taipei", "تايوان"], arabicName: "تايوان", flag: "🇹🇼", luSlug: "taiwan", verified: true },
    { name: "Myanmar", code: "MM", slug: "mm", aliases: ["mmr", "burma", "yangon", "rohingya", "ميانمار", "بورما"], arabicName: "ميانمار", flag: "🇲🇲", luSlug: "myanmar", verified: true },
    { name: "Australia", code: "AU", slug: "au", aliases: ["aus", "aussie", "canberra", "sydney", "أستراليا", "استراليا"], arabicName: "أستراليا", flag: "🇦🇺", verified: true },
    { name: "New Zealand", code: "NZ", slug: "nz", aliases: ["nzl", "aotearoa", "wellington", "auckland", "نيوزيلندا", "نيوزيلاندا"], arabicName: "نيوزيلندا", flag: "🇳🇿", verified: true },
  ];
});
