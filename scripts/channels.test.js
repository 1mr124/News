// ---------------------------------------------------------------
// Sanity checks for the CHANNELS array in index.html.
// Run:  node scripts/channels.test.js
// Exits non-zero on any failure so it can gate CI.
//
// CHANNELS is a plain array literal inline in index.html (no module), so this
// slices it out of the file text and eval()s just that literal.
// ---------------------------------------------------------------
var fs = require("fs");
var path = require("path");

var html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
var start = html.indexOf("const CHANNELS = [");
var end = html.indexOf("\n];", start);
if (start === -1 || end === -1) {
  console.error("FAIL  couldn't locate the CHANNELS array literal in index.html");
  process.exit(1);
}
var literal = html.slice(start + "const CHANNELS = ".length, end + 2); // include "\n]" + ";"
var CHANNELS = eval("(" + literal.replace(/;\s*$/, "") + ")");

var pass = 0, fail = 0;
function ok(cond, label) {
  if (cond) { pass++; console.log("  ok    " + label); }
  else { fail++; console.log("  FAIL  " + label); }
}

console.log("CHANNELS array (" + CHANNELS.length + " entries):");
ok(Array.isArray(CHANNELS) && CHANNELS.length > 60, "parsed, non-trivial length");

var UC = /^UC[\w-]{22}$/;
var seenHandle = {};
var liveCount = 0, regularCount = 0;

CHANNELS.forEach(function (c, i) {
  var at = "[" + i + "] " + (c && c.name);
  ok(c && typeof c.name === "string" && c.name.trim() !== "", at + " — has name");
  ok(c && typeof c.handle === "string" && /^[\w.-]+$/.test(c.handle), at + " — plausible handle");
  ok(c && (c.type === "live" || c.type === "regular"), at + " — type is live|regular");
  ok(c && typeof c.group === "string" && c.group.trim() !== "", at + " — has group");
  ok(c && (c.id === null || UC.test(c.id)), at + " — id is null or UC…22");
  if (c && c.type === "live") liveCount++;
  if (c && c.type === "regular") regularCount++;
  if (c && c.handle) {
    var key = c.handle.toLowerCase();
    // handle doubles as a cache key; a repeat is allowed only when it's the
    // same outlet twice (same id) — e.g. "NBC News" + "NBC News NOW".
    if (seenHandle[key]) ok(seenHandle[key] === (c.id || "null"), at + " — repeated handle @" + c.handle + " keeps same id");
    else seenHandle[key] = c.id || "null";
  }
});

ok(liveCount > 0 && regularCount > 0, "both categories populated (live=" + liveCount + ", regular=" + regularCount + ")");

// Category is derived from type; a group must not straddle both categories,
// or its rows would render under two different headers.
var groupType = {};
var straddle = null;
CHANNELS.forEach(function (c) {
  if (!c || !c.group) return;
  if (groupType[c.group] && groupType[c.group] !== c.type) straddle = c.group;
  groupType[c.group] = groupType[c.group] || c.type;
});
ok(!straddle, "no group mixes live + regular entries" + (straddle ? " (offender: " + straddle + ")" : ""));

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
