// ---------------------------------------------------------------
// LIVEUAMAP EXPLORER — the "World Map" tab UI.
//
// LiveuamapExplorer.init(mountEl) builds a two-pane view inside mountEl:
//   left  = fuzzy search (countries + topic maps) + Popular / Topics
//           quick-picks + Watchlist
//   right = a bar (current country / pin / reset / open ↗) + a panel that
//           opens the country's Liveuamap page in a new tab.
//
// NOTE: the live map is NOT embedded. Liveuamap sends
// X-Frame-Options: sameorigin (and 403s the framed request), so an <iframe>
// can't render here. This is an interim state — real map data will come from
// the Liveuamap API (pending access), replacing this panel.
//
// Depends on two globals (loaded as plain <script> before this file, the
// same way config.js is):
//   LIVEUAMAP_COUNTRIES   (data/liveuamapCountries.js)
//   LiveuamapSearch        (lib/liveuamapSearch.js)
//
// State that must survive reloads (the watchlist) is kept in localStorage
// under a `newstv_` key, matching the rest of the app.
// ---------------------------------------------------------------
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LiveuamapExplorer = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var PINS_KEY = "newstv_liveuamap_pins_v1";
  var DEFAULT_PINS = ["egypt", "ukraine", "israelpalestine", "lebanon", "syria", "iran", "sudan", "libya"];
  var POPULAR = ["egypt", "ukraine", "lebanon", "syria", "iran"];

  // Left-panel collapse state — mirrors the Channels nav toggle
  // (newstv_nav_collapsed). Lets the map take the full width / viewport.
  var SIDE_KEY = "newstv_liveuamap_side_collapsed";

  // LiveUAMap serves each country subdomain in a chosen UI/content language via
  // a leading path segment (…/ar, …/en, …). Arabic is the default; the picker in
  // the map bar repoints the "Open" link to the chosen language, and the choice
  // is remembered in localStorage the same way the watchlist is. Codes/labels
  // mirror LiveUAMap's own language menu.
  var LANG_KEY = "newstv_liveuamap_lang_v1";
  var DEFAULT_LANG = "ar";
  var LANGS = [
    { code: "ar", label: "العربية" },
    { code: "en", label: "English" },
    { code: "tr", label: "Türkçe" },
    { code: "es", label: "Español" },
    { code: "pt", label: "Português" },
    { code: "fr", label: "Français" },
    { code: "de", label: "Deutsch" },
    { code: "pl", label: "Polski" },
    { code: "nl", label: "Nederlands" },
    { code: "il", label: "עברית" },
    { code: "fa", label: "فارسی" },
    { code: "ku", label: "Kurdî" },
  ];
  function isLang(code) {
    for (var i = 0; i < LANGS.length; i++) if (LANGS[i].code === code) return true;
    return false;
  }
  // Set by init() so other tabs (e.g. Google News) can jump straight to a
  // country here. Stays null until the World Map tab has been opened once.
  var activeOpenBySlug = null;

  // -- tiny DOM helper (imperative, matches the rest of the codebase) -----
  function el(tag, attrs, kids) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "class") node.className = attrs[k];
        else if (k === "text") node.textContent = attrs[k];
        else if (k === "html") node.innerHTML = attrs[k];
        else if (k.indexOf("on") === 0 && typeof attrs[k] === "function") node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] != null) node.setAttribute(k, attrs[k]);
      });
    }
    (kids || []).forEach(function (c) {
      if (c == null) return;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }

  function urlFor(country, lang) {
    return "https://" + country.slug + ".liveuamap.com/" + (lang || DEFAULT_LANG) + "?savelanguage=true";
  }
  function label(country) {
    return (country.flag ? country.flag + " " : "") + country.name;
  }

  // -- watchlist persistence (mirror of the app's localStorage pattern) ---
  function loadPins() {
    try {
      var raw = localStorage.getItem(PINS_KEY);
      if (raw === null) {
        savePins(DEFAULT_PINS);
        return DEFAULT_PINS.slice();
      }
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return DEFAULT_PINS.slice();
    }
  }
  function savePins(arr) {
    try {
      localStorage.setItem(PINS_KEY, JSON.stringify(arr));
    } catch (e) {
      /* private mode / storage disabled — pins just won't persist */
    }
  }

  function loadLang() {
    try {
      var v = localStorage.getItem(LANG_KEY);
      return v && isLang(v) ? v : DEFAULT_LANG;
    } catch (e) {
      return DEFAULT_LANG;
    }
  }
  function saveLang(code) {
    try {
      localStorage.setItem(LANG_KEY, code);
    } catch (e) {
      /* private mode / storage disabled — language just won't persist */
    }
  }

  function loadSideCollapsed() {
    try {
      return localStorage.getItem(SIDE_KEY) === "1";
    } catch (e) {
      return false;
    }
  }
  function saveSideCollapsed(v) {
    try {
      localStorage.setItem(SIDE_KEY, v ? "1" : "0");
    } catch (e) {
      /* private mode / storage disabled — the choice just won't persist */
    }
  }

  function init(mountEl) {
    if (!mountEl || mountEl.dataset.luInit === "1") return;
    mountEl.dataset.luInit = "1";

    var g = typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : this;
    var COUNTRIES = g.LIVEUAMAP_COUNTRIES;
    var SEARCH = g.LiveuamapSearch;
    if (!COUNTRIES || !SEARCH) {
      mountEl.appendChild(el("div", { class: "empty", text: "World Map failed to load (missing data/liveuamapCountries.js or lib/liveuamapSearch.js)." }));
      return;
    }

    var VERIFIED = COUNTRIES.filter(function (c) { return c.verified === true; });
    var TOPICS = VERIFIED.filter(function (c) { return c.kind === "topic"; });
    function bySlug(slug) {
      for (var i = 0; i < COUNTRIES.length; i++) if (COUNTRIES[i].slug === slug) return COUNTRIES[i];
      return null;
    }

    // ---- state -------------------------------------------------------
    var pins = loadPins();
    var lang = loadLang(); // LiveUAMap display language (path segment in urlFor)
    var current = null; // currently selected country
    var results = []; // current search results
    var highlight = 0; // keyboard-highlighted index into results

    // ---- DOM skeleton ---------------------------------------------------
    var input = el("input", {
      type: "search",
      id: "luSearch",
      placeholder: "Search country or topic…",
      "aria-label": "Search country or topic",
      autocomplete: "off",
      role: "combobox",
      "aria-expanded": "false",
    });
    var resultsBox = el("div", { class: "lu-results", id: "luResults", role: "listbox", hidden: "" });
    var popularWrap = el("div", { class: "lu-section", id: "luPopular" });
    var pinsWrap = el("div", { class: "lu-section", id: "luPinsSection" });
    var topicsWrap = el("div", { class: "lu-section", id: "luTopics" });
    var side = el("div", { class: "lu-side" }, [
      el("div", { class: "lu-searchbox" }, [input]),
      el("div", { class: "lu-scroll" }, [popularWrap, pinsWrap, topicsWrap, resultsBox]),
    ]);

    var currentLabel = el("span", { class: "lu-current" });
    var langSel = el("select", { class: "hdrbtn lu-lang", "aria-label": "Map language", title: "Map language" },
      LANGS.map(function (l) { return el("option", { value: l.code }, [l.label]); }));
    langSel.value = lang;
    var pinBtn = el("button", { class: "hdrbtn lu-pin", type: "button", title: "Pin / unpin this country" });
    var resetBtn = el("button", { class: "hdrbtn", type: "button", text: "Reset" });
    var openBtn = el("button", { class: "hdrbtn lu-open", type: "button", text: "Open in new tab ↗" });
    var bar = el("div", { class: "lu-bar" }, [currentLabel, el("span", { class: "lu-bar-spacer" }), langSel, pinBtn, resetBtn, openBtn]);
    var frame = el("div", { class: "lu-frame", id: "luFrame" });
    var mapWrap = el("div", { class: "lu-mapwrap" }, [bar, frame]);

    // Left-panel collapse toggle — same chevron/markup as the Channels #navToggle.
    var toggleBtn = el("button", {
      class: "lu-toggle",
      type: "button",
      "aria-label": "Toggle panel",
      html:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>' +
        '<span class="lu-toggle-label"></span>',
    });
    var sideCollapsed = loadSideCollapsed();
    function applySideState(collapsed) {
      mountEl.classList.toggle("lu-collapsed", collapsed);
      toggleBtn.setAttribute("aria-expanded", String(!collapsed));
      toggleBtn.title = collapsed ? "Show panel" : "Hide panel";
      var lbl = toggleBtn.querySelector(".lu-toggle-label");
      if (lbl) lbl.textContent = collapsed ? "Show list" : "Hide list";
    }
    toggleBtn.addEventListener("click", function () {
      sideCollapsed = !sideCollapsed;
      applySideState(sideCollapsed);
      saveSideCollapsed(sideCollapsed);
    });

    mountEl.appendChild(side);
    mountEl.appendChild(mapWrap);
    mountEl.appendChild(toggleBtn);

    // ---- rendering ----------------------------------------------------
    function chip(country, opts) {
      opts = opts || {};
      var b = el("button", {
        class: "lu-chip" + (current && current.slug === country.slug ? " active" : ""),
        type: "button",
        onclick: function () { openCountry(country); },
      }, [document.createTextNode(label(country))]);
      if (opts.unpin) {
        b.appendChild(el("span", {
          class: "lu-chip-x",
          title: "Remove from watchlist",
          text: "×",
          onclick: function (e) {
            e.stopPropagation();
            togglePin(country.slug);
          },
        }));
      }
      return b;
    }

    function renderPopular() {
      popularWrap.replaceChildren(el("div", { class: "lu-section-title", text: "Popular" }));
      var row = el("div", { class: "lu-chips" });
      POPULAR.forEach(function (slug) {
        var c = bySlug(slug);
        if (c && c.verified === true) row.appendChild(chip(c));
      });
      popularWrap.appendChild(row);
    }

    function renderTopics() {
      if (!TOPICS.length) {
        topicsWrap.replaceChildren();
        topicsWrap.hidden = true;
        return;
      }
      topicsWrap.replaceChildren(el("div", { class: "lu-section-title", text: "Topics" }));
      var row = el("div", { class: "lu-chips" });
      TOPICS.forEach(function (c) { row.appendChild(chip(c)); });
      topicsWrap.appendChild(row);
    }

    function renderPins() {
      pinsWrap.replaceChildren(el("div", { class: "lu-section-title", text: "Watchlist" }));
      var known = pins.map(bySlug).filter(function (c) { return c && c.verified === true; });
      if (!known.length) {
        pinsWrap.appendChild(el("div", { class: "lu-hint", text: "No pinned countries. Load one and press ★ to pin it." }));
        return;
      }
      var row = el("div", { class: "lu-chips" });
      known.forEach(function (c) { row.appendChild(chip(c, { unpin: true })); });
      pinsWrap.appendChild(row);
    }

    function renderResults() {
      resultsBox.replaceChildren();
      if (!results.length) {
        resultsBox.appendChild(el("div", { class: "no-results", text: "No matches" }));
        return;
      }
      results.forEach(function (c, i) {
        var row = el("div", {
          class: "lu-result" + (i === highlight ? " hl" : "") + (current && current.slug === c.slug ? " active" : ""),
          role: "option",
          "aria-selected": i === highlight ? "true" : "false",
          onclick: function () { openCountry(c); },
          onmousemove: function () {
            if (highlight !== i) {
              highlight = i;
              paintHighlight();
            }
          },
        }, [
          el("span", { class: "lu-result-flag", text: c.flag || "•" }),
          el("span", { class: "lu-result-name", text: c.name }),
        ]);
        resultsBox.appendChild(row);
      });
    }

    // cheap re-paint of just the highlight class (no full rebuild on arrow keys)
    function paintHighlight() {
      var rows = resultsBox.querySelectorAll(".lu-result");
      for (var i = 0; i < rows.length; i++) {
        var on = i === highlight;
        rows[i].classList.toggle("hl", on);
        rows[i].setAttribute("aria-selected", on ? "true" : "false");
        if (on && rows[i].scrollIntoView) rows[i].scrollIntoView({ block: "nearest" });
      }
    }

    function showEmptyState() {
      resultsBox.hidden = true;
      popularWrap.hidden = false;
      pinsWrap.hidden = false;
      topicsWrap.hidden = !TOPICS.length;
      input.setAttribute("aria-expanded", "false");
    }
    function showResultsState() {
      resultsBox.hidden = false;
      popularWrap.hidden = true;
      pinsWrap.hidden = true;
      topicsWrap.hidden = true;
      input.setAttribute("aria-expanded", "true");
    }

    function renderBar() {
      var has = !!current;
      currentLabel.textContent = has ? "Currently viewing: " + label(current) : "Pick a country or topic to load its live map";
      pinBtn.hidden = !has;
      resetBtn.hidden = !has;
      openBtn.hidden = !has || current.verified !== true;
      if (has) {
        var pinned = pins.indexOf(current.slug) !== -1;
        pinBtn.textContent = pinned ? "★ Pinned" : "☆ Pin";
        pinBtn.classList.toggle("on", pinned);
      }
    }

    // ---- actions ----------------------------------------------------
    function runSearch() {
      var q = input.value;
      if (!q.trim()) {
        results = [];
        showEmptyState();
        return;
      }
      results = SEARCH.searchCountries(q, VERIFIED);
      highlight = 0;
      renderResults();
      showResultsState();
    }

    function openCountry(country) {
      if (!country) return;
      current = country;
      input.value = "";
      results = [];
      showEmptyState();
      renderPopular();
      renderTopics();
      renderPins();
      renderBar();
      renderMapPanel(country);
    }

    // The Liveuamap embed is intentionally disabled: their pages send
    // X-Frame-Options: sameorigin (and 403 the framed request), so an <iframe>
    // can never render here. Until API access lands, the map area is just a
    // static panel offering to open the country's Liveuamap page in a new tab.
    // The language picker only changes which URL that button targets.
    function renderMapPanel(country) {
      if (country.verified !== true) {
        frame.replaceChildren(el("div", { class: "empty lu-fallback" }, [
          el("strong", { text: label(country) }),
          el("div", {
            class: "lu-fallback-msg",
            text: country.name + " isn't covered by Liveuamap, so there's no live map to open.",
          }),
        ]));
        return;
      }
      frame.replaceChildren(el("div", { class: "empty lu-fallback" }, [
        el("strong", { text: label(country) }),
        el("div", { class: "lu-fallback-msg", text: "Liveuamap can't be embedded here right now." }),
        el("div", { class: "lu-fallback-actions" }, [
          el("button", {
            class: "hdrbtn",
            type: "button",
            text: "Open Liveuamap ↗",
            onclick: function () { window.open(urlFor(country, lang), "_blank", "noopener,noreferrer"); },
          }),
        ]),
      ]));
    }

    function togglePin(slug) {
      var i = pins.indexOf(slug);
      if (i === -1) pins.push(slug);
      else pins.splice(i, 1);
      savePins(pins);
      renderPins();
      renderBar();
      renderResults();
    }

    function reset() {
      current = null;
      input.value = "";
      results = [];
      showEmptyState();
      renderPopular();
      renderTopics();
      renderPins();
      renderBar();
      frame.replaceChildren(el("div", { class: "empty", text: "Search for a country or topic, or pick one from Popular / Topics / your Watchlist to load its live map." }));
    }

    // ---- wiring ----------------------------------------------------
    input.addEventListener("input", runSearch);
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") {
        if (!results.length) return;
        e.preventDefault();
        highlight = Math.min(highlight + 1, results.length - 1);
        paintHighlight();
      } else if (e.key === "ArrowUp") {
        if (!results.length) return;
        e.preventDefault();
        highlight = Math.max(highlight - 1, 0);
        paintHighlight();
      } else if (e.key === "Enter") {
        if (results.length) {
          e.preventDefault();
          openCountry(results[highlight] || results[0]);
        }
      } else if (e.key === "Escape") {
        if (input.value) {
          e.preventDefault();
          input.value = "";
          runSearch();
        } else {
          input.blur();
        }
      }
    });
    pinBtn.addEventListener("click", function () { if (current) togglePin(current.slug); });
    resetBtn.addEventListener("click", reset);
    openBtn.addEventListener("click", function () {
      if (current && current.verified === true) window.open(urlFor(current, lang), "_blank", "noopener,noreferrer");
    });
    langSel.addEventListener("change", function () {
      lang = isLang(langSel.value) ? langSel.value : DEFAULT_LANG;
      langSel.value = lang;
      saveLang(lang);
      if (current) renderMapPanel(current); // repoint the "Open" link to the new language
    });

    // Let other tabs open a country here by slug (see Google News tab).
    activeOpenBySlug = function (slug) {
      var c = bySlug(slug);
      if (!c || c.verified !== true) return false;
      openCountry(c);
      return true;
    };

    // ---- first paint ------------------------------------------------
    applySideState(sideCollapsed); // restore the panel collapse state
    reset(); // paints Popular + Watchlist + bar + the "pick a country" panel
    // focus the search when the tab is opened
    setTimeout(function () { try { input.focus(); } catch (e) {} }, 0);
  }

  // openCountryBySlug(slug) — used by the Google News tab's "World Map ↗"
  // cross-link. Returns false if the tab isn't built yet or the slug is
  // unknown/unverified. Additive: does not change init()'s behaviour.
  function openCountryBySlug(slug) {
    return activeOpenBySlug ? activeOpenBySlug(slug) : false;
  }

  return { init: init, openCountryBySlug: openCountryBySlug };
});
