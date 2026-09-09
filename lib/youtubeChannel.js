// ---------------------------------------------------------------
// YOUTUBE CHANNEL DISCOVERY HELPERS  (pure, framework-agnostic)
//
// The "📺 Channels" tab needs a robust fallback hierarchy for each outlet:
//
//   manual override  ->  playable live  ->  live-but-blocked  ->
//   recent videos    ->  "set a video manually" card
//
// so a channel never shows an empty player or a bare "isn't live" message.
// This module holds the decision logic only — no DOM, no network — so it can
// be unit-tested with node (see scripts/youtubeChannel.test.js). index.html
// does the fetching (YouTube Data API v3) and feeds the raw resources here.
//
// Exposes:
//   YouTubeChannel.extractVideoId(input)        -> 11-char id | null
//   YouTubeChannel.uploadsPlaylistId(channelId) -> "UU…" | null
//   YouTubeChannel.classifyVideo(item, opts)    -> { id, state, embeddable, regionBlocked, title, startsAt, startedAt, publishedAt }
//   YouTubeChannel.classifyList(items, opts)    -> classifyVideo[]  (maps videos.list .items)
//   YouTubeChannel.pickPrimary(classified)      -> { state, primaryVideoId, liveVideoId, startsAt, recent:[{id,title}] }
//
// classifyVideo state:  "live" | "upcoming" | "ended" | "video" | "unavailable"
// pickPrimary   state:  "live" | "region_blocked" | "embed_disabled" |
//                       "upcoming" | "offline" | "empty"
// ---------------------------------------------------------------
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.YouTubeChannel = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // Accepts a full YouTube URL (watch, embed, share, youtu.be, /live/, /shorts/,
  // /v/) or a bare 11-char video id. Returns the id or null.
  function extractVideoId(input) {
    var s = String(input == null ? "" : input).trim();
    if (!s) return null;
    if (/^[\w-]{11}$/.test(s)) return s;
    var patterns = [
      /[?&]v=([\w-]{11})/,      // watch?v=…  and  live?v=…
      /youtu\.be\/([\w-]{11})/,
      /\/embed\/([\w-]{11})/,
      /\/live\/([\w-]{11})/,
      /\/shorts\/([\w-]{11})/,
      /\/v\/([\w-]{11})/,
    ];
    for (var i = 0; i < patterns.length; i++) {
      var m = s.match(patterns[i]);
      if (m) return m[1];
    }
    return null;
  }

  // A channel's "uploads" playlist always mirrors its channel id with the
  // second character bumped: UC… -> UU…. Fetching this playlist (1 quota unit)
  // reliably surfaces an active live stream as its newest item even when the
  // eventually-consistent live search (search.list?eventType=live, 100 units)
  // hasn't caught up yet.
  function uploadsPlaylistId(channelId) {
    if (typeof channelId === "string" && /^UC[\w-]{22}$/.test(channelId)) {
      return "UU" + channelId.slice(2);
    }
    return null;
  }

  function upper(x) { return String(x || "").toUpperCase(); }

  function isRegionBlocked(regionRestriction, region) {
    if (!regionRestriction || !region) return false;
    var r = upper(region);
    var blocked = regionRestriction.blocked;
    var allowed = regionRestriction.allowed;
    if (Array.isArray(blocked) && blocked.map(upper).indexOf(r) !== -1) return true;
    if (Array.isArray(allowed) && allowed.length && allowed.map(upper).indexOf(r) === -1) return true;
    return false;
  }

  // Classify one videos.list resource fetched with
  //   part=snippet,liveStreamingDetails,status,contentDetails
  // opts.region (optional, ISO-3166-1 alpha-2) enables the regionBlocked check.
  function classifyVideo(item, opts) {
    opts = opts || {};
    if (!item || !item.id) {
      return {
        id: (item && item.id) || null,
        state: "unavailable", embeddable: false, regionBlocked: false,
        title: "", startsAt: null, startedAt: null, publishedAt: null,
      };
    }
    var snip = item.snippet || {};
    var lsd = item.liveStreamingDetails || null;
    var status = item.status || {};
    var cd = item.contentDetails || {};

    var base = {
      id: item.id,
      title: snip.title || "",
      publishedAt: snip.publishedAt || null,
      startsAt: lsd ? (lsd.scheduledStartTime || null) : null,
      startedAt: lsd ? (lsd.actualStartTime || null) : null,
      embeddable: status.embeddable !== false, // default true when unknown
      regionBlocked: isRegionBlocked(cd.regionRestriction, opts.region),
    };

    var priv = status.privacyStatus;
    var up = status.uploadStatus;
    if (priv === "private" || up === "deleted" || up === "rejected" || up === "failed") {
      base.state = "unavailable";
      base.embeddable = false;
      return base;
    }

    var lbc = snip.liveBroadcastContent; // "live" | "upcoming" | "none" | undefined
    var state;
    if (lsd) {
      if (lsd.actualEndTime) state = "ended";
      else if (lsd.actualStartTime) state = "live";
      else if (lsd.scheduledStartTime || lbc === "upcoming") state = "upcoming";
      else state = lbc === "live" ? "live" : "upcoming";
    } else {
      if (lbc === "live") state = "live";
      else if (lbc === "upcoming") state = "upcoming";
      else state = "video";
    }
    base.state = state;
    return base;
  }

  function classifyList(items, opts) {
    return (items || []).map(function (it) { return classifyVideo(it, opts); });
  }

  function sortKey(c) { return c.startedAt || c.publishedAt || ""; }
  function byNewest(a, b) {
    var ka = sortKey(a), kb = sortKey(b);
    return ka < kb ? 1 : ka > kb ? -1 : 0;
  }

  // Given a list of classifyVideo() results (live-search hits + recent uploads,
  // in any order), decide what the channel card should show.
  function pickPrimary(classified) {
    var seen = {};
    var list = (classified || []).filter(function (c) {
      if (!c || !c.id || seen[c.id]) return false;
      seen[c.id] = true;
      return true;
    }).sort(byNewest);

    var lives = list.filter(function (c) { return c.state === "live"; });
    var playableLive = lives.filter(function (c) { return c.embeddable && !c.regionBlocked; });
    var upcomings = list.filter(function (c) { return c.state === "upcoming"; });
    // The recent-videos grid: real uploads + ended live replays, never the
    // active/blocked live itself, never unavailable/upcoming.
    var recentList = list.filter(function (c) { return c.state === "video" || c.state === "ended"; });
    var recent = recentList.map(function (c) { return { id: c.id, title: c.title }; });
    var firstRecentId = recent.length ? recent[0].id : null;

    if (playableLive.length) {
      return { state: "live", primaryVideoId: playableLive[0].id, liveVideoId: playableLive[0].id, startsAt: null, recent: recent };
    }
    if (lives.length) {
      var blk = lives[0];
      var state = blk.regionBlocked ? "region_blocked" : (!blk.embeddable ? "embed_disabled" : "region_blocked");
      return { state: state, primaryVideoId: firstRecentId, liveVideoId: blk.id, startsAt: null, recent: recent };
    }
    if (upcomings.length) {
      return { state: "upcoming", primaryVideoId: firstRecentId, liveVideoId: null, startsAt: upcomings[0].startsAt || null, recent: recent };
    }
    if (recent.length) {
      return { state: "offline", primaryVideoId: firstRecentId, liveVideoId: null, startsAt: null, recent: recent };
    }
    return { state: "empty", primaryVideoId: null, liveVideoId: null, startsAt: null, recent: [] };
  }

  return {
    extractVideoId: extractVideoId,
    uploadsPlaylistId: uploadsPlaylistId,
    isRegionBlocked: isRegionBlocked,
    classifyVideo: classifyVideo,
    classifyList: classifyList,
    pickPrimary: pickPrimary,
  };
});
