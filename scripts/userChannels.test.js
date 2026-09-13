// ---------------------------------------------------------------
// Unit tests for user-channel backup (export/import).
// Run:  node scripts/userChannels.test.js
// Exits non-zero on any failure so it can gate CI.
// Covers: export shape (persistent definitions only + version),
// import validation/sanitization, canonical-ID duplicate detection,
// built-in protection (caller-side), malformed + version handling.
// Discovery logic itself is unchanged (see youtubeChannel.test.js).
// ---------------------------------------------------------------
var YT = require("../lib/youtubeChannel.js");

var pass = 0;
var fail = 0;

function eq(label, got, want) {
  var g = JSON.stringify(got);
  var w = JSON.stringify(want);
  if (g === w) {
    pass++;
    console.log("  ok    " + label);
  } else {
    fail++;
    console.log("  FAIL  " + label + "\n        expected " + w + "\n        got      " + g);
  }
}

var ID_A = "UCoMdktPbSTixAyNGwb-UYkQ";
var ID_B = "UC16niRr50-MSBwiO3YDb3RA";

function userRow(over) {
  var base = {
    name: "My News", handle: "mynews", id: ID_A,
    type: "live", group: "My Channels", userAdded: true, addedAt: 123,
  };
  return Object.assign(base, over || {});
}

// -- buildUserChannelsExport -------------------------------------------
console.log("buildUserChannelsExport:");
var payload = YT.buildUserChannelsExport([userRow()], "2026-09-13T00:00:00.000Z");
eq("has version field", payload.version, 1);
eq("has app field", payload.app, "newstv-user-channels");
eq("has exportedAt", payload.exportedAt, "2026-09-13T00:00:00.000Z");
eq("count matches", payload.count, 1);
eq("channels length", payload.channels.length, 1);
eq("no live/meta leakage", Object.keys(payload.channels[0]).sort(),
  ["addedAt", "group", "handle", "id", "name", "type", "userAdded"]);
eq("empty list exports cleanly",
  YT.buildUserChannelsExport([], "2026-09-13T00:00:00.000Z").channels, []);
eq("drops corrupt rows on export",
  YT.buildUserChannelsExport([userRow(), { junk: true }], "2026-09-13T00:00:00.000Z").count, 1);

// -- parseUserChannelsImport -------------------------------------------
console.log("parseUserChannelsImport:");
var good = {
  app: "newstv-user-channels", version: 1,
  exportedAt: "2026-09-13T00:00:00.000Z", count: 1,
  channels: [userRow()],
};
var r1 = YT.parseUserChannelsImport(good);
eq("valid payload ok", r1.ok, true);
eq("valid payload channels", r1.channels.length, 1);

eq("malformed JSON object rejected", YT.parseUserChannelsImport({ nope: 1 }).ok, false);
eq("null rejected", YT.parseUserChannelsImport(null).ok, false);
eq("string rejected", YT.parseUserChannelsImport("junk").ok, false);
eq("missing channels rejected", YT.parseUserChannelsImport({ version: 1 }).ok, false);
eq("wrong version rejected", YT.parseUserChannelsImport({ version: 99, channels: [userRow()] }),
  { ok: false, error: "version" });
eq("all-corrupt channels rejected",
  YT.parseUserChannelsImport({ version: 1, channels: [{ junk: true }] }),
  { ok: false, error: "invalid" });
eq("mixed array keeps valid rows", YT.parseUserChannelsImport([null, userRow(), 42, "x"]).channels.length, 1);
eq("all-garbage array rejected, not thrown", YT.parseUserChannelsImport([null, 42, "x"]).ok, false);

// -- duplicate semantics (canonical UC id first) ------------------------
console.log("duplicates:");
var builtins = [
  { name: "Sky News", handle: "skynews", id: ID_A, type: "live", group: "International News" },
];
var importDupId = YT.parseUserChannelsImport({
  version: 1, channels: [userRow({ name: "Renamed", handle: "otherhandle", id: ID_A })],
});
eq("import parses even when id collides", importDupId.ok, true);
// Caller-side: canonical UC id match blocks the import even under a new handle.
eq("duplicate by UC id detected",
  !!YT.findChannelDuplicate(importDupId.channels[0].id, importDupId.channels[0].handle, builtins), true);

var importDupHandle = YT.parseUserChannelsImport({
  version: 1, channels: [userRow({ name: "Clone", handle: "SKYNEWS", id: ID_B })],
});
eq("duplicate by handle (case-insensitive) detected",
  !!YT.findChannelDuplicate(importDupHandle.channels[0].id, importDupHandle.channels[0].handle, builtins), true);

var importFresh = YT.parseUserChannelsImport({
  version: 1, channels: [userRow({ handle: "brandnew", id: ID_B })],
});
eq("fresh channel not flagged",
  YT.findChannelDuplicate(importFresh.channels[0].id, importFresh.channels[0].handle, builtins), null);

console.log("");
console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
