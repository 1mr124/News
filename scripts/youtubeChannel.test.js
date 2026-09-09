// ---------------------------------------------------------------
// Unit tests for the pure YouTube discovery helpers.
// Run:  node scripts/youtubeChannel.test.js
// Exits non-zero on any failure so it can gate CI.
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

// -- extractVideoId ---------------------------------------------------------
console.log("extractVideoId:");
eq("bare id", YT.extractVideoId("7nncuuV30DE"), "7nncuuV30DE");
eq("watch url", YT.extractVideoId("https://www.youtube.com/watch?v=lk0PX03twOM&t=10"), "lk0PX03twOM");
eq("youtu.be share", YT.extractVideoId("https://youtu.be/7nncuuV30DE"), "7nncuuV30DE");
eq("youtu.be + query", YT.extractVideoId("https://youtu.be/7nncuuV30DE?si=abc"), "7nncuuV30DE");
eq("embed url", YT.extractVideoId("https://www.youtube.com/embed/lk0PX03twOM"), "lk0PX03twOM");
eq("/live/ url", YT.extractVideoId("https://www.youtube.com/live/lk0PX03twOM?feature=share"), "lk0PX03twOM");
eq("/shorts/ url", YT.extractVideoId("https://www.youtube.com/shorts/abcdefghijk"), "abcdefghijk");
eq("whitespace", YT.extractVideoId("  7nncuuV30DE  "), "7nncuuV30DE");
eq("garbage", YT.extractVideoId("not a video"), null);
eq("empty", YT.extractVideoId(""), null);
eq("null", YT.extractVideoId(null), null);
eq("channel url (no video)", YT.extractVideoId("https://www.youtube.com/@skynews"), null);

// -- uploadsPlaylistId ----------------------------------------------------
console.log("uploadsPlaylistId:");
eq("UC -> UU", YT.uploadsPlaylistId("UCoMdktPbSTixAyNGwb-UYkQ"), "UUoMdktPbSTixAyNGwb-UYkQ");
eq("bad id", YT.uploadsPlaylistId("garbage"), null);
eq("null", YT.uploadsPlaylistId(null), null);

// -- classifyVideo fixtures ---------------------------------------------
function vid(id, over) {
  var base = {
    id: id,
    snippet: { title: "T-" + id, publishedAt: "2026-09-09T10:00:00Z", liveBroadcastContent: "none" },
    status: { privacyStatus: "public", uploadStatus: "processed", embeddable: true },
    contentDetails: {},
  };
  return Object.assign(base, over || {});
}

console.log("classifyVideo:");
eq("normal upload", YT.classifyVideo(vid("up1")).state, "video");
eq("active live", YT.classifyVideo(vid("lv1", {
  snippet: { title: "L", publishedAt: "2026-09-09T09:00:00Z", liveBroadcastContent: "live" },
  liveStreamingDetails: { actualStartTime: "2026-09-09T09:00:00Z" },
})).state, "live");
eq("upcoming (scheduled, not started)", YT.classifyVideo(vid("up2", {
  snippet: { title: "U", publishedAt: "2026-09-09T08:00:00Z", liveBroadcastContent: "upcoming" },
  liveStreamingDetails: { scheduledStartTime: "2026-09-10T09:00:00Z" },
})).state, "upcoming");
eq("upcoming is NOT live (root cause 5)", YT.classifyVideo(vid("up3", {
  liveStreamingDetails: { scheduledStartTime: "2026-09-10T09:00:00Z" },
})).state, "upcoming");
eq("ended live replay", YT.classifyVideo(vid("en1", {
  liveStreamingDetails: { actualStartTime: "2026-09-08T09:00:00Z", actualEndTime: "2026-09-08T12:00:00Z" },
})).state, "ended");
eq("private -> unavailable", YT.classifyVideo(vid("pv1", { status: { privacyStatus: "private", embeddable: true } })).state, "unavailable");
eq("deleted -> unavailable", YT.classifyVideo(vid("dl1", { status: { uploadStatus: "deleted" } })).state, "unavailable");
eq("missing item -> unavailable", YT.classifyVideo(null).state, "unavailable");
eq("embeddable=false surfaced", YT.classifyVideo(vid("nb1", { status: { privacyStatus: "public", embeddable: false } })).embeddable, false);
eq("region blocked (blocked list)", YT.classifyVideo(vid("rb1", {
  contentDetails: { regionRestriction: { blocked: ["GB", "IE"] } },
}), { region: "GB" }).regionBlocked, true);
eq("region blocked (not in allowed list)", YT.classifyVideo(vid("rb2", {
  contentDetails: { regionRestriction: { allowed: ["US", "CA"] } },
}), { region: "GB" }).regionBlocked, true);
eq("region ok when allowed", YT.classifyVideo(vid("rb3", {
  contentDetails: { regionRestriction: { allowed: ["US", "GB"] } },
}), { region: "GB" }).regionBlocked, false);
eq("no region opt -> not blocked", YT.classifyVideo(vid("rb4", {
  contentDetails: { regionRestriction: { blocked: ["GB"] } },
})).regionBlocked, false);

// -- pickPrimary -------------------------------------------------------
console.log("pickPrimary:");
var C = YT.classifyVideo;

// playable live wins, recent grid excludes the live itself
var r1 = YT.pickPrimary([
  C(vid("liveA", { snippet: { title: "live", publishedAt: "2026-09-09T09:00:00Z", liveBroadcastContent: "live" }, liveStreamingDetails: { actualStartTime: "2026-09-09T09:00:00Z" } })),
  C(vid("recentA", { snippet: { title: "r1", publishedAt: "2026-09-08T09:00:00Z", liveBroadcastContent: "none" } })),
]);
eq("live: state", r1.state, "live");
eq("live: primary is the live", r1.primaryVideoId, "liveA");
eq("live: recent excludes live", r1.recent.map(function (x) { return x.id; }), ["recentA"]);

// region-blocked live -> recent fallback, live kept as liveVideoId
var r2 = YT.pickPrimary([
  C(vid("bbcLive", { snippet: { title: "live", publishedAt: "2026-09-09T09:00:00Z", liveBroadcastContent: "live" }, liveStreamingDetails: { actualStartTime: "2026-09-09T09:00:00Z" }, contentDetails: { regionRestriction: { blocked: ["GB"] } } }), { region: "GB" }),
  C(vid("bbcR1", { snippet: { title: "r1", publishedAt: "2026-09-09T08:00:00Z", liveBroadcastContent: "none" } })),
  C(vid("bbcR2", { snippet: { title: "r2", publishedAt: "2026-09-08T08:00:00Z", liveBroadcastContent: "none" } })),
]);
eq("region_blocked: state", r2.state, "region_blocked");
eq("region_blocked: primary is newest recent", r2.primaryVideoId, "bbcR1");
eq("region_blocked: liveVideoId kept", r2.liveVideoId, "bbcLive");

// embed-disabled live -> recent fallback
var r3 = YT.pickPrimary([
  C(vid("edLive", { snippet: { title: "live", publishedAt: "2026-09-09T09:00:00Z", liveBroadcastContent: "live" }, liveStreamingDetails: { actualStartTime: "2026-09-09T09:00:00Z" }, status: { privacyStatus: "public", embeddable: false } })),
  C(vid("edR1", { snippet: { title: "r1", publishedAt: "2026-09-09T08:00:00Z", liveBroadcastContent: "none" } })),
]);
eq("embed_disabled: state", r3.state, "embed_disabled");
eq("embed_disabled: primary is recent", r3.primaryVideoId, "edR1");

// upcoming only -> not live
var r4 = YT.pickPrimary([
  C(vid("upLive", { snippet: { title: "u", publishedAt: "2026-09-09T09:00:00Z", liveBroadcastContent: "upcoming" }, liveStreamingDetails: { scheduledStartTime: "2026-09-10T09:00:00Z" } })),
  C(vid("upR1", { snippet: { title: "r1", publishedAt: "2026-09-08T09:00:00Z", liveBroadcastContent: "none" } })),
]);
eq("upcoming: state", r4.state, "upcoming");
eq("upcoming: startsAt", r4.startsAt, "2026-09-10T09:00:00Z");
eq("upcoming: primary is recent", r4.primaryVideoId, "upR1");

// no live -> offline, newest recent first
var r5 = YT.pickPrimary([
  C(vid("offR_old", { snippet: { title: "old", publishedAt: "2026-09-01T09:00:00Z", liveBroadcastContent: "none" } })),
  C(vid("offR_new", { snippet: { title: "new", publishedAt: "2026-09-09T09:00:00Z", liveBroadcastContent: "none" } })),
]);
eq("offline: state", r5.state, "offline");
eq("offline: primary is newest", r5.primaryVideoId, "offR_new");
eq("offline: recent order newest-first", r5.recent.map(function (x) { return x.id; }), ["offR_new", "offR_old"]);

// nothing usable -> empty
var r6 = YT.pickPrimary([
  C(vid("p1", { status: { privacyStatus: "private" } })),
  C(null),
]);
eq("empty: state", r6.state, "empty");
eq("empty: primary null", r6.primaryVideoId, null);

// multiple concurrent lives -> newest by actualStartTime
var r7 = YT.pickPrimary([
  C(vid("liveEarly", { snippet: { title: "e", publishedAt: "2026-09-09T06:00:00Z", liveBroadcastContent: "live" }, liveStreamingDetails: { actualStartTime: "2026-09-09T06:00:00Z" } })),
  C(vid("liveLate", { snippet: { title: "l", publishedAt: "2026-09-09T05:00:00Z", liveBroadcastContent: "live" }, liveStreamingDetails: { actualStartTime: "2026-09-09T11:00:00Z" } })),
]);
eq("multi-live: newest actualStartTime wins", r7.primaryVideoId, "liveLate");

// de-dupe by id
var r8 = YT.pickPrimary([
  C(vid("dup", { snippet: { title: "a", publishedAt: "2026-09-09T09:00:00Z", liveBroadcastContent: "none" } })),
  C(vid("dup", { snippet: { title: "a", publishedAt: "2026-09-09T09:00:00Z", liveBroadcastContent: "none" } })),
]);
eq("de-dupe: one recent entry", r8.recent.length, 1);

console.log("");
console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
