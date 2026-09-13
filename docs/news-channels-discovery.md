# News Channels — YouTube discovery & fallback

How the **📺 Channels** tab decides what to show for each outlet. Logic lives in
`lib/youtubeChannel.js` (pure, unit-tested by `scripts/youtubeChannel.test.js`);
fetching + rendering live in `index.html`.

## Channel `type` — grouping & autoplay

Every entry in the `CHANNELS` array has a `type`:

- **`"live"`** — outlet runs an always-on 24/7 stream or livestreams breaking
  coverage near-daily. Listed under the **Live Streams** category. The player
  autoplays **only** when a discovery check reports it currently live
  (`meta.state` is `live` / `manual_live` — the `LIVE_STATES` map). A `live`
  channel that's currently offline falls back to recent videos and loads paused.
- **`"regular"`** — on-demand uploads / documentaries. Listed under the
  **News & Documentaries** category. **Never autoplays** under any state; the
  100-unit `search.list?eventType=live` backstop is skipped for these.

The sidebar's two top-level categories are derived from `type`
(`categoryOf()` in `render()`); the `group` field is the sub-heading within a
category and keeps its first-appearance order in the array.

## Fallback hierarchy (per channel)

1. **Manual override** — `manualLiveVideo` in the `CHANNELS` config, or a value
   the user saved via the "Manual video" popover (`newstv_video_ids_v1`).
   Always honoured; overrides auto-detection until cleared.
2. **Playable live** — a currently-live video that is embeddable and not
   region-restricted → shown as the main player, strip reads `● LIVE`.
3. **Live but unavailable here** — a live video was found but is region-blocked
   (`contentDetails.regionRestriction`) or has embedding disabled
   (`status.embeddable=false`), or the embed throws player error 101/150 at play
   time → strip reads `LIVE — unavailable in your region` /
   `… embedding disabled`, and the newest recent upload plays instead.
4. **Upcoming only** — a scheduled stream that has not started
   (`liveBroadcastContent="upcoming"` / `scheduledStartTime` with no
   `actualStartTime`) → strip reads `Upcoming — starts <time>`, newest recent
   upload plays. Upcoming is never treated as live.
5. **Recent videos** — no live/upcoming → strip reads `Latest from <name>`, the
   newest upload plays, and a grid of recent uploads sits below.
6. **Nothing playable** — bad handle, empty uploads, or an API error with no
   cached recents → a small card with "Set Live Video" + "Open on YouTube".
   Never a blank player, never a bare "channel isn't live".

## API calls & quota

| Step | Endpoint | Cost | When |
|------|----------|------|------|
| Resolve `@handle` → `UC…` id | `channels.list?forHandle` | 1 | once per handle, cached in `newstv_custom_ids_v1` |
| Recent uploads (+ active live shows up here as the newest item) | `playlistItems.list` on the `UU…` uploads playlist | 1 | every discovery |
| Classify up to 50 ids | `videos.list?part=snippet,liveStreamingDetails,status,contentDetails` | 1 / 50 ids | every discovery, and the bulk re-check in "Fetch All" |
| Backstop live search | `search.list?eventType=live&order=date` | 100 | single-channel click only, only when the uploads scan found no live/upcoming, and only for `type: "live"` channels — never in bulk "Fetch All" |

"Fetch All" over ~70 channels costs **~140 units** (1 + ~70 + ~70), versus
~4,000–7,000 with the old per-channel `search.list`. Results are cached for 15
min (`REFRESH_TTL_MS`); failed checks retry after 3 min.

## Caches (localStorage)

- `newstv_custom_ids_v1` — resolved channel ids.
- `newstv_video_ids_v1` — **manual overrides only**; never auto-deleted.
- `newstv_video_meta_v1` — per-channel discovery result: `{ checkedAt, state,
  liveVideoId, primaryVideoId, recent:[{id,title}], startsAt }`.
- `newstv_blocked_vids_v1` — video ids whose embed failed this session; skipped
  when picking a video, cleared for a channel when it is re-discovered.
- `newstv_region` — optional ISO-3166-1 alpha-2 code; when set, feeds the
  `regionRestriction` check in `classifyVideo`.
- `newstv_user_channels_v1` — user-added channels ("+ Add Channel"): array of
  `{ handle, id, name, group: "My Channels", type: "live", userAdded: true,
  addedAt }`. Merged in memory after the built-in `CHANNELS` array, so user
  rows use the same discovery/player/fallback pipeline. Validated by
  `YouTubeChannel.isUserChannel()` / `sanitizeUserChannels()`; identity for
  duplicate checks is the UC… id first, lowercase handle second
  (`findChannelDuplicate()`). Removing a user row also clears its manual
  override and cached discovery result. Built-in rows are never mutated.

## Known limitations

- `search.list?eventType=live` is eventually-consistent; a stream that went live
  <1 min ago can be missed until the next refresh (the uploads-playlist scan
  usually catches it sooner).
- Player error codes 101 and 150 don't distinguish "embedding disabled" from
  "geo-blocked" — the UI message covers both. Real region playability is only
  known once the embed loads.
- The client-side API key is visible in request URLs (unavoidable for a static
  site); restrict it by HTTP referrer in Google Cloud Console.
- A channel whose configured `id` is wrong/stale (or whose `@handle` doesn't
  resolve) lands in the "nothing playable" card — fix it with a manual video or
  by correcting the id in `CHANNELS`.
