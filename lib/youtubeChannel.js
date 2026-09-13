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
//   YouTubeChannel.parseChannelReference(input) -> { kind, value, legacy? } | null
//   YouTubeChannel.isUserChannel(obj)           -> bool (shape check for persisted user rows)
//   YouTubeChannel.findChannelDuplicate(id, handle, list) -> entry | null
//   YouTubeChannel.sanitizeUserChannels(arr)    -> valid, de-duped user rows
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

  // Accepts a YouTube channel reference and normalizes it to a canonical
  // lookup form. Supported (all resolvable with the existing channels.list
  // infrastructure — 1 quota unit each):
  //   bare UC… id ............................ -> { kind: "id", value }
  //   youtube.com/channel/UC… (any scheme/host) -> { kind: "id", value }
  //   youtube.com/@handle[/…] or bare @handle/handle -> { kind: "handle", value }
  // Legacy /c/<name> and /user/<name> URLs parse to
  //   { kind: "unsupported", legacy: "custom"|"user" } — the Data API has no
  //   cheap lookup for those, so the UI asks for the @handle or UC… ID instead
  //   rather than burning search quota or misreporting "not found".
  // Video references (watch?v=, youtu.be, /shorts/, bare 11-char video id)
  // and non-YouTube input return null (invalid input, not "not found").
  var CHANNEL_ID_RE = /^UC[\w-]{22}$/;
  var HANDLE_RE = /^[\w.-]+$/;
  function parseChannelReference(input) {
    var s = String(input == null ? "" : input).trim();
    if (!s) return null;
    if (CHANNEL_ID_RE.test(s)) return { kind: "id", value: s };
    // A bare video id or video URL is a common mix-up — reject as invalid
    // input (never "channel not found").
    if (/^[\w-]{11}$/.test(s)) return null;
    var lower = s.toLowerCase();
    var isYtHost = lower.indexOf("youtube.com") !== -1 || lower.indexOf("youtu.be") !== -1;
    if (isYtHost) {
      var m = s.match(/\/channel\/(UC[\w-]{22})/);
      if (m) return { kind: "id", value: m[1] };
      var h = s.match(/\/@([\w.-]+)/);
      if (h) return { kind: "handle", value: h[1] };
      var c = s.match(/\/c\/([^\/?#\s]+)/i);
      if (c) return { kind: "unsupported", legacy: "custom", value: c[1] };
      var u = s.match(/\/user\/([^\/?#\s]+)/i);
      if (u) return { kind: "unsupported", legacy: "user", value: u[1] };
      return null;
    }
    // Bare handle: "@skynews", "skynews". "@" alone or whitespace is invalid.
    var bare = s.charAt(0) === "@" ? s.slice(1) : s;
    if (bare && bare.indexOf(" ") === -1 && bare.indexOf("/") === -1 && HANDLE_RE.test(bare)) {
      return { kind: "handle", value: bare };
    }
    return null;
  }

  // Shape check for a persisted user-added channel row. Same field contract
  // as the CHANNELS literal (see scripts/channels.test.js); plus the
  // userAdded discriminator so builtins are never mistaken for user rows.
  function isUserChannel(obj) {
    if (!obj || typeof obj !== "object") return false;
    return typeof obj.name === "string" && obj.name.trim() !== "" &&
      typeof obj.handle === "string" && HANDLE_RE.test(obj.handle) &&
      (obj.id === null || (typeof obj.id === "string" && CHANNEL_ID_RE.test(obj.id))) &&
      (obj.type === "live" || obj.type === "regular") &&
      typeof obj.group === "string" && obj.group.trim() !== "";
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

  // Canonical duplicate check for the Add Channel flow. Identity is the UC…
  // id first, normalized lowercase handle second (handles are also the
  // localStorage cache key). Returns the matching entry or null.
  function findChannelDuplicate(id, handle, list) {
    var arr = Array.isArray(list) ? list : [];
    var normHandle = String(handle || "").toLowerCase();
    for (var i = 0; i < arr.length; i++) {
      var c = arr[i];
      if (!c) continue;
      if (id && c.id && c.id === id) return c;
      if (normHandle && String(c.handle || "").toLowerCase() === normHandle) return c;
    }
    return null;
  }

  // Validate + de-dupe a persisted user-channel array (e.g. loaded from
  // localStorage). Drops corrupt rows and later duplicates, keeps the first
  // of each id/handle. Returns a new array — never throws.
  function sanitizeUserChannels(arr) {
    var out = [];
    var seenId = {};
    var seenHandle = {};
    (Array.isArray(arr) ? arr : []).forEach(function (c) {
      if (!isUserChannel(c)) return;
      var hk = String(c.handle).toLowerCase();
      if ((c.id && seenId[c.id]) || seenHandle[hk]) return;
      if (c.id) seenId[c.id] = true;
      seenHandle[hk] = true;
      out.push(c);
    });
    return out;
  }

  return {
    extractVideoId: extractVideoId,
    parseChannelReference: parseChannelReference,
    isUserChannel: isUserChannel,
    findChannelDuplicate: findChannelDuplicate,
    sanitizeUserChannels: sanitizeUserChannels,
    uploadsPlaylistId: uploadsPlaylistId,
    isRegionBlocked: isRegionBlocked,
    classifyVideo: classifyVideo,
    classifyList: classifyList,
    pickPrimary: pickPrimary,
  };
});
