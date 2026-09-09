# News Channels — YouTube discovery & fallback

How the **📺 Channels** tab decides what to show for each outlet. Logic lives in
`lib/youtubeChannel.js` (pure, unit-tested by `scripts/youtubeChannel.test.js`);
fetching + rendering live in `index.html`.

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
| Backstop live search | `search.list?eventType=live&order=date` | 100 | single-channel click only, and only when the uploads scan found no live/upcoming — never in bulk "Fetch All" |

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
