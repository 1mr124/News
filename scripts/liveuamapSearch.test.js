// ---------------------------------------------------------------
// Unit tests for the pure country search (spec section 9).
// Run:  node scripts/liveuamapSearch.test.js
// Exits non-zero on any failure so it can gate CI.
// ---------------------------------------------------------------
var COUNTRIES = require("../data/liveuamapCountries.js");
var search = require("../lib/liveuamapSearch.js").searchCountries;

var pass = 0;
var fail = 0;

function top(query) {
  var r = search(query, COUNTRIES);
  return r.length ? r[0].name : null;
}

// expect the top result for `query` to be the country named `name`
function expectTop(query, name) {
  var got = top(query);
  if (got === name) {
    pass++;
    console.log("  ok    " + JSON.stringify(query) + " -> " + name);
  } else {
    fail++;
    console.log("  FAIL  " + JSON.stringify(query) + " -> expected " + name + ", got " + got);
  }
}

// expect no results at all
function expectNone(query) {
  var r = search(query, COUNTRIES);
  if (r.length === 0) {
    pass++;
    console.log("  ok    " + JSON.stringify(query) + " -> (no matches)");
  } else {
    fail++;
    console.log("  FAIL  " + JSON.stringify(query) + " -> expected no matches, got " + r.map(function (c) { return c.name; }).join(", "));
  }
}

// expect `name` to appear somewhere in the results (not necessarily first)
function expectIncludes(query, name) {
  var r = search(query, COUNTRIES);
  if (r.some(function (c) { return c.name === name; })) {
    pass++;
    console.log("  ok    " + JSON.stringify(query) + " includes " + name);
  } else {
    fail++;
    console.log("  FAIL  " + JSON.stringify(query) + " -> expected to include " + name + ", got " + r.map(function (c) { return c.name; }).join(", "));
  }
}

console.log("Egypt aliases / casing / Arabic:");
expectTop("egy", "Egypt");
expectTop("egyp", "Egypt");
expectTop("egypt", "Egypt");
expectTop("EGYPT", "Egypt");
expectTop("  Egypt  ", "Egypt");
expectTop("مصر", "Egypt");
expectTop("مِصر", "Egypt"); // with tashkeel

console.log("Ukraine:");
expectTop("ukr", "Ukraine");
expectTop("Ukraine", "Ukraine");
expectTop("ukriane", "Ukraine"); // transposition typo

console.log("Lebanon / Iran:");
expectTop("leb", "Lebanon");
expectTop("iran", "Iran");
expectTop("إيران", "Iran");

console.log("No / unsupported matches:");
expectNone("zzzzz");
expectNone("");
expectNone("   ");
// Antarctica isn't in the dataset at all
expectNone("antarctica");
// Morocco IS in the dataset but verified:false -> must not be searchable
expectNone("morocco");
expectNone("المغرب");

console.log("Region aliases still resolve:");
expectIncludes("gaza", "Israel–Palestine");
expectIncludes("palestine", "Israel–Palestine");
expectIncludes("haiti", "Caribbean");
expectIncludes("north korea", "Korean Peninsula");
expectIncludes("burma", "Myanmar");

console.log("");
console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
