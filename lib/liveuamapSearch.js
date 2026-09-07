// ---------------------------------------------------------------
// LIVEUAMAP FUZZY COUNTRY SEARCH  (pure, framework-agnostic)
//
// Exposes searchCountries(query, countries) -> ranked LiveuamapCountry[].
// No DOM, no network, no per-country special-casing — matching generalises
// from name + slug + aliases + arabicName alone. Kept out of the UI
// component so it's independently testable (see scripts/liveuamapSearch.test.js).
// ---------------------------------------------------------------
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LiveuamapSearch = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // Arabic diacritics (tashkeel), superscript alef, and tatweel — all noise
  // for matching. Removed before comparing so "مِصْر" == "مصر".
  var ARABIC_MARKS = /[ؐ-ًؚ-ٰٟۖ-ۜ۟-۪ۨ-ۭـ]/g;

  // Normalise a string for comparison:
  //  - Unicode NFKC (fold compatibility forms, presentation forms)
  //  - lowercase
  //  - strip Arabic tashkeel + tatweel
  //  - fold Arabic letter variants that users type interchangeably
  //  - drop punctuation/symbols, collapse whitespace, trim
  function normalize(str) {
    if (str == null) return "";
    var s = String(str);
    s = s.normalize ? s.normalize("NFKC") : s;
    s = s.toLowerCase();
    s = s.replace(ARABIC_MARKS, "");
    s = s
      .replace(/[آأإٱ]/g, "ا") // آ أ إ ٱ -> ا
      .replace(/ة/g, "ه") // ة -> ه
      .replace(/ى/g, "ي") // ى -> ي
      .replace(/ؤ/g, "و") // ؤ -> و
      .replace(/ئ/g, "ي"); // ئ -> ي
    // Keep letters (any script), numbers and spaces; everything else -> space.
    try {
      s = s.replace(/[^\p{L}\p{N}\s]+/gu, " ");
    } catch (e) {
      s = s.replace(/[^0-9a-z؀-ۿ\s]+/g, " ");
    }
    return s.replace(/\s+/g, " ").trim();
  }

  // Classic iterative Levenshtein (two-row). Small inputs (country names),
  // so this is plenty fast and avoids pulling in a fuzzy-search library.
  function editDistance(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    var prev = new Array(b.length + 1);
    var curr = new Array(b.length + 1);
    for (var j = 0; j <= b.length; j++) prev[j] = j;
    for (var i = 1; i <= a.length; i++) {
      curr[0] = i;
      for (var k = 1; k <= b.length; k++) {
        var cost = a.charCodeAt(i - 1) === b.charCodeAt(k - 1) ? 0 : 1;
        curr[k] = Math.min(curr[k - 1] + 1, prev[k] + 1, prev[k - 1] + cost);
      }
      var tmp = prev;
      prev = curr;
      curr = tmp;
    }
    return prev[b.length];
  }

  // Score one normalized candidate term against the normalized query.
  // Higher is better; 0 means "no match".
  function scoreTerm(term, q, isName) {
    if (!term) return 0;
    if (term === q) return 100;
    if (term.indexOf(q) === 0) return 82 + (isName ? 4 : 0); // term starts with query: "egy" -> "egypt"
    if (q.indexOf(term) === 0) return 70; // query starts with term: "ukr..." matches alias "ukr"
    if (term.indexOf(q) !== -1) return 60; // substring
    if (q.length >= 3) {
      var d = editDistance(term, q);
      if (d === 1) return 45;
      if (d === 2 && q.length >= 4) return 30;
      // typo against just the start of a longer term ("egyp" vs "egypt")
      if (term.length > q.length) {
        var d2 = editDistance(term.slice(0, q.length), q);
        if (d2 <= 1) return 40;
      }
    }
    return 0;
  }

  // Best score across all of a country's searchable terms.
  function scoreCountry(country, q) {
    var terms = [country.name, country.slug].concat(country.aliases || []);
    if (country.arabicName) terms.push(country.arabicName);
    var best = 0;
    for (var i = 0; i < terms.length; i++) {
      var isName = i === 0;
      var s = scoreTerm(normalize(terms[i]), q, isName);
      if (s > best) best = s;
    }
    return best;
  }

  // Public: fuzzy-search the local dataset. Returns a new array, ranked
  // best-first. results[0] is the "Enter opens this" target.
  //
  // Only `verified` countries are considered (an unverified slug must never
  // become a selectable/linkable result). Pass an empty/whitespace query
  // to get [] — callers show their "popular" state instead.
  function searchCountries(query, countries) {
    var list = Array.isArray(countries) ? countries : [];
    var q = normalize(query);
    if (!q) return [];
    var scored = [];
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (!c || c.verified !== true) continue;
      var s = scoreCountry(c, q);
      if (s > 0) scored.push({ c: c, s: s, idx: i });
    }
    scored.sort(function (a, b) {
      if (b.s !== a.s) return b.s - a.s;
      if (a.c.name.length !== b.c.name.length) return a.c.name.length - b.c.name.length;
      return a.c.name.localeCompare(b.c.name);
    });
    return scored.map(function (x) {
      return x.c;
    });
  }

  return { searchCountries: searchCountries, normalize: normalize, editDistance: editDistance };
});
