# Task: Add a "Liveuamap Explorer" feature to the existing News dashboard

You are working inside an **existing** News dashboard project (aggregates/watches YouTube news channels). This is an **addition**, not a rewrite. Read everything below before writing any code.

---

## 0. Discovery phase (do this first, before designing anything)

Do not assume a stack or file layout. Actually inspect the repo:

1. Run a directory listing / `tree` (or equivalent) to understand the project layout.
2. Identify the framework (React/Vue/Svelte/plain JS, Next.js/Vite/CRA, etc.), the language (JS/TS), and package manager.
3. Find and read the routing/navigation setup (how tabs/pages are registered).
4. Find and read the existing design system: shared components (buttons, inputs, modals/dropdowns, cards), theme/CSS variables or Tailwind config, dark-mode handling.
5. Find how the existing "channel search" / filters are implemented — you should mirror that pattern for the new country search rather than inventing a new one.
6. Identify state management approach (Context, Redux, Zustand, plain hooks, localStorage usage patterns already in the app).
7. Only after this discovery, decide where the new feature fits (new tab vs. new section) and briefly state your plan before implementing.

If the project has no existing patterns for something (e.g., no existing localStorage usage), pick the simplest option consistent with the rest of the stack and note the choice in your final summary.

---

## 1. Feature overview

Add a **Liveuamap Explorer** ("Liveuamap" or "World Map" tab/section — pick whichever fits the existing nav labeling conventions) that lets a user fuzzy-search for a country and view that country's live map at `https://<slug>.liveuamap.com/`, embedded if possible, otherwise opened in a new tab.

Reference: https://liveuamap.com/ and its per-region subdomains, e.g. https://ukraine.liveuamap.com/, https://egypt.liveuamap.com/, https://lebanon.liveuamap.com/, https://syria.liveuamap.com/, https://iran.liveuamap.com/

---

## 2. Country dataset (build this first, as its own module)

Create a standalone data file (e.g. `data/liveuamapCountries.ts|js`), separate from any UI component, shaped like:

```ts
interface LiveuamapCountry {
  name: string;        // "Egypt"
  slug: string;        // "egypt" -> https://egypt.liveuamap.com/
  aliases: string[];   // ["egy", "egyp", "مصر", "egyptian"]
  arabicName?: string; // "مصر"
  flag?: string;       // "🇪🇬"
  verified: boolean;   // true only if you confirmed the subdomain actually resolves/loads (see below)
}
```

**Important — do not assume every country has a Liveuamap subdomain.** Liveuamap only covers roughly 30+ regions/conflict zones, not all ~195 countries (confirmed: it advertises "30+ regions" including Ukraine, Israel-Palestine, Syria, Venezuela, Libya, and similar active-interest areas). So:

- Seed the dataset with a reasonable starting list of well-known Liveuamap regions (Ukraine, Russia, Israel, Palestine/Gaza, Lebanon, Syria, Iran, Iraq, Egypt, Libya, Sudan, Yemen, Afghanistan, Venezuela, Myanmar, Taiwan, and any others you can verify), each with a handful of aliases (English abbreviations, common misspellings, and — where you're confident of correctness — the native/Arabic name).
- For each entry, **verify the URL before marking `verified: true`**: attempt an HTTP request (e.g. HEAD/GET) to `https://<slug>.liveuamap.com/` and check for a successful response. If you don't have live network access in this environment, implement the verification as a small script/utility that a human (or a later CI step) can run, and default `verified` conservatively — do not silently mark unverified entries as supported in a way that produces dead links.
- Only countries with `verified: true` (or explicitly whitelisted by you after manual confirmation) should be searchable/selectable in the UI. Unsupported countries should not appear as if they work.
- Structure the file so adding a new country is a one-line object addition — no code changes elsewhere required.

---

## 3. Fuzzy country search

Implement this as a **pure, framework-agnostic function** (e.g. `searchCountries(query, countries): LiveuamapCountry[]`) that the UI component calls — keep search logic out of the component itself so it's independently testable.

Requirements:

- No network request per keystroke — search the local dataset only.
- No hardcoded per-country logic (e.g. no `if (query === 'egy')`). The matching must generalize from `name` + `aliases` + `arabicName` alone.
- Normalize before comparing:
  - lowercase (and case-fold for non-Latin scripts where relevant)
  - trim/collapse whitespace
  - strip punctuation
  - normalize Unicode (NFKC) so Arabic text with different diacritics/forms still matches, and strip Arabic diacritics (tashkeel) before comparing
- Matching strategy (lightweight, no heavy dependency — a small Levenshtein/prefix/substring implementation is enough; do not pull in a large fuzzy-search library for this):
  1. Exact match (name, slug, or any alias) → highest rank.
  2. Prefix match (query is a prefix of name/alias) → e.g. `"egy"` → Egypt.
  3. Substring/contains match.
  4. Small edit-distance tolerance (1–2 edits) for typos, e.g. `"egyp"` still hits Egypt.
- Rank/sort results so the best match is first (used for "Enter opens first result when unambiguous").
- Must correctly handle the examples in section 6 (test list) including the Arabic query.

---

## 4. UI/UX

Build a component (reusing existing shared UI primitives — inputs, dropdown/listbox, buttons, cards — do not create parallel one-off styled elements):

- A search input with a placeholder like "Search country…" and a live-updating results list as the user types (no submit button required to see results).
- Each result row shows flag (if available) + country name.
- "No matching countries" empty state.
- A "Popular" / quick-pick row of chips (Egypt, Ukraine, Lebanon, Syria, Iran) shown when the search is empty.
- Keyboard support: Arrow Up/Down to move selection, Enter to open the highlighted/only-unambiguous result, Escape to clear/close the results list.
- Clear visual indication of the currently selected/loaded country (e.g. highlighted chip, header showing "Currently viewing: Egypt").
- A "Reset" control and an "Open in new tab ↗" control (the latter always available, even when embedding works).
- **Watchlist/favorites**: allow pinning countries (e.g. Egypt, Ukraine, Gaza/Palestine, Lebanon, Syria, Iran, Israel, Sudan, Libya as reasonable defaults), persisted via `localStorage`, following whatever localStorage/persistence pattern the app already uses elsewhere (or the simplest reasonable pattern if none exists). Clicking a pinned country switches the map immediately.
- Recent searches: nice-to-have, only add if it doesn't add meaningful complexity — a small capped list (e.g. last 5) in localStorage is enough.
- Match the app's existing look: colors, spacing, typography, buttons, and dark-mode handling if the app has a dark theme. Do not introduce a new visual style.
- Keep the UI clean — do not add every possible feature listed here if it starts to feel cluttered. Favor omitting a nice-to-have over bloating the UI.

---

## 5. Embedding vs. fallback (must verify, not assume)

Before building the embed path, check whether `https://<slug>.liveuamap.com/` can actually be iframed:

- Inspect response headers for `X-Frame-Options` and `Content-Security-Policy` (specifically `frame-ancestors`) on a couple of representative subdomains (e.g. ukraine.liveuamap.com, egypt.liveuamap.com).
- If embedding is blocked: implement the **fallback only** — do not attempt to bypass the restriction (no proxying, no stripping headers, no server-side rendering workaround to dodge the block). Show a clear message, e.g. "Liveuamap can't be embedded here. Open Egypt on Liveuamap ↗" with a button that opens the country page in a new tab (`window.open(..., '_blank', 'noopener,noreferrer')`).
- If embedding works for at least some subdomains: render the iframe as large as the dashboard layout reasonably allows, and still keep the "Open in new tab" button visible.
- Handle iframe load failures gracefully at runtime too (e.g. an `onError`/timeout check), since a subdomain that loads outside an iframe can still fail differently when embedded.
- State clearly in your final summary whether embedding worked, for which countries you tested it, and exactly what fallback behavior you implemented.

---

## 6. Error handling — cover all of these with a real message (never a blank screen)

- Country not found in search → "No matching countries"
- Selected country exists in dataset but is not `verified`/supported → explain it's not available on Liveuamap, don't attempt to load it
- Liveuamap unreachable / network failure → distinct message from "not supported"
- Iframe blocked → fallback message + open-in-new-tab button (section 5)
- Iframe loads but errors after mount → same fallback treatment

---

## 7. Optional integration point (only if it fits naturally)

If the existing dashboard already associates news items/channels with a country or region (i.e., the data already exists — do not build article-to-location extraction from scratch), consider adding a small "View on Liveuamap ↗" action near that existing country/region context that jumps into this new feature with that country pre-selected. Skip this entirely if there's no existing country/region data to hook into — do not invent one.

---

## 8. Constraints (do not violate these)

- Do not break existing YouTube/channel functionality, filters, channel search, configuration, layout, keyboard shortcuts, or responsive behavior.
- Do not rewrite unrelated existing code.
- Do not add a heavy fuzzy-search dependency (e.g. Fuse.js-scale libraries) if a ~50-line local implementation covers the requirements — but you may use a small, already-present utility in the project if one exists.
- Keep the country dataset, the search function, and the UI component in separate, clearly-named files/modules.
- No hardcoded single-country logic anywhere in the search implementation.
- Do not attempt to bypass Liveuamap's iframe security restrictions under any circumstances.

---

## 9. Testing checklist (do this before reporting done)

Manually verify (write quick scripts/tests where practical, otherwise describe how you checked):

- [ ] `egy`, `egyp`, `egypt`, `EGYPT`, `مصر` all resolve to Egypt
- [ ] `ukr`, `Ukraine` resolve to Ukraine
- [ ] `leb` resolves to Lebanon; `iran` resolves to Iran
- [ ] A nonsense/unsupported query (e.g. `zzzzz`, or a real country Liveuamap doesn't cover) shows "No matching countries" or a clear "not supported" message — no broken link is ever generated
- [ ] Arrow keys move selection, Enter opens the top/unambiguous result, Escape clears
- [ ] Iframe embedding behavior confirmed for at least 2 subdomains, and the correct fallback path is exercised for at least one blocked case (real or simulated)
- [ ] Watchlist pin/unpin persists across a page reload
- [ ] Existing dashboard tabs, channel search/filters, and layout still work unchanged
- [ ] Responsive layout holds at a mobile width

---

## 10. Final deliverable — end with a concise summary covering

- Files changed/added
- Components added
- Country-search approach (algorithm + normalization used)
- How Liveuamap URLs are generated, and how you decided which countries are `verified`/supported
- Whether iframe embedding actually works, and for which countries you tested it
- Exactly what fallback UX was implemented for blocked/failed embeds
- Any additional features you included beyond the core search+view (watchlist, recent searches, cross-links, etc.)
- Any limitations (e.g. incomplete country coverage, unverifiable subdomains, environment lacked network access to test embedding, etc.)

Make the smallest clean implementation that integrates naturally with the existing codebase — do not rewrite the whole project.
