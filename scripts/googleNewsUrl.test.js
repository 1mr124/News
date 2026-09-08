// ---------------------------------------------------------------
// Unit tests for the pure Google News URL builder.
// Run:  node scripts/googleNewsUrl.test.js
// Exits non-zero on any failure so it can gate CI.
// ---------------------------------------------------------------
var GN = require("../lib/googleNewsUrl.js");
var COUNTRIES = require("../data/googleNewsCountries.js");

var pass = 0;
var fail = 0;

function expect(label, got, want) {
  if (got === want) {
    pass++;
    console.log("  ok    " + label);
  } else {
    fail++;
    console.log("  FAIL  " + label + "\n          got:  " + got + "\n          want: " + want);
  }
}
function expectTrue(label, cond) {
  expect(label, !!cond, true);
}

console.log("Edition params (hl / gl / ceid):");
expect(
  "Arabic + Egypt, Top Stories",
  GN.build({ code: "EG", lang: "ar", topic: "top" }),
  "https://news.google.com/home?hl=ar&gl=EG&ceid=EG%3Aar"
);
expect(
  "English + Egypt, Top Stories",
  GN.build({ code: "EG", lang: "en", topic: "top" }),
  "https://news.google.com/home?hl=en&gl=EG&ceid=EG%3Aen"
);
expect(
  "lower-case code is upper-cased",
  GN.build({ code: "us", lang: "en", topic: "top" }),
  "https://news.google.com/home?hl=en&gl=US&ceid=US%3Aen"
);

console.log("Topic sections:");
expect(
  "Technology, Arabic + Egypt",
  GN.build({ code: "EG", lang: "ar", topic: "TECHNOLOGY" }),
  "https://news.google.com/headlines/section/topic/TECHNOLOGY?hl=ar&gl=EG&ceid=EG%3Aar"
);
expect(
  "Sports, English + UK",
  GN.build({ code: "GB", lang: "en", topic: "SPORTS" }),
  "https://news.google.com/headlines/section/topic/SPORTS?hl=en&gl=GB&ceid=GB%3Aen"
);
expect(
  "unknown topic falls back to /home",
  GN.build({ code: "US", lang: "en", topic: "BOGUS" }),
  "https://news.google.com/home?hl=en&gl=US&ceid=US%3Aen"
);

console.log("Custom search:");
expect(
  "query overrides topic, space -> %20",
  GN.build({ code: "EG", lang: "ar", topic: "TECHNOLOGY", query: "Egypt economy" }),
  "https://news.google.com/search?q=Egypt%20economy&hl=ar&gl=EG&ceid=EG%3Aar"
);
expect(
  "blank query is ignored (still a topic URL)",
  GN.build({ code: "EG", lang: "ar", topic: "WORLD", query: "   " }),
  "https://news.google.com/headlines/section/topic/WORLD?hl=ar&gl=EG&ceid=EG%3Aar"
);
expect(
  "query is trimmed",
  GN.build({ code: "US", lang: "en", query: "  AI  " }),
  "https://news.google.com/search?q=AI&hl=en&gl=US&ceid=US%3Aen"
);
expect(
  "special chars in query are encoded",
  GN.build({ code: "US", lang: "en", query: "AT&T earnings" }),
  "https://news.google.com/search?q=AT%26T%20earnings&hl=en&gl=US&ceid=US%3Aen"
);

console.log("Fallbacks / defaults:");
expect(
  "missing code -> US",
  GN.build({ lang: "en", topic: "top" }),
  "https://news.google.com/home?hl=en&gl=US&ceid=US%3Aen"
);
expect(
  "invalid lang -> en",
  GN.build({ code: "EG", lang: "zz", topic: "top" }),
  "https://news.google.com/home?hl=en&gl=EG&ceid=EG%3Aen"
);
expect(
  "no opts at all",
  GN.build(),
  "https://news.google.com/home?hl=en&gl=US&ceid=US%3Aen"
);

console.log("Dataset sanity:");
expectTrue("dataset is a non-empty array", Array.isArray(COUNTRIES) && COUNTRIES.length > 40);
expectTrue(
  "every entry has UPPER code, lower slug, verified, flag",
  COUNTRIES.every(function (c) {
    return (
      typeof c.code === "string" && c.code === c.code.toUpperCase() && c.code.length === 2 &&
      c.slug === c.code.toLowerCase() &&
      c.verified === true &&
      typeof c.name === "string" && c.name &&
      typeof c.flag === "string" && c.flag
    );
  })
);
expectTrue(
  "codes are unique",
  new Set(COUNTRIES.map(function (c) { return c.code; })).size === COUNTRIES.length
);
expectTrue(
  "Egypt present with luSlug 'egypt'",
  COUNTRIES.some(function (c) { return c.code === "EG" && c.luSlug === "egypt"; })
);

console.log("");
console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
