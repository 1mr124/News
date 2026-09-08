// ---------------------------------------------------------------
// GOOGLE NEWS EXPLORER — the "Google News" tab UI.
//
// GoogleNewsExplorer.init(mountEl) builds a two-pane view inside mountEl,
// modelled on lib/liveuamapExplorer.js (same DOM shape + class names, so it
// reuses the World Map tab's layout / collapse / mobile-fullscreen CSS):
//   left  = fuzzy country search + Popular / Watchlist quick-picks +
//           Language / Topic / custom-search controls
//   right = a bar (current country / pin / reset / open ↗ / World Map ↗) and
//           a "launch panel" — Google News can't be embedded (see below), so
//           this shows the resolved URL and an "Open Google News ↗" button.
//
// Google News sends `X-Frame-Options: SAMEORIGIN` (verified 2026-09-08), so
// there is no iframe here and nothing tries to bypass that. If Google ever
// drops the header, an iframe branch could be added in renderView().
//
// Depends on three globals (plain <script> tags before this file, like config.js):
//   GOOGLE_NEWS_COUNTRIES  (data/googleNewsCountries.js)
//   LiveuamapSearch        (lib/liveuamapSearch.js — the pure search fn, reused)
//   GoogleNewsUrl          (lib/googleNewsUrl.js — the pure URL builder)
//
// State worth remembering (country / language / topic / query / watchlist /
// panel-collapse) is kept in localStorage under `newstv_` keys, matching the
// rest of the app.
// ---------------------------------------------------------------
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.GoogleNewsExplorer = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var COUNTRY_KEY = "newstv_googlenews_country_v1";
  var LANG_KEY = "newstv_googlenews_lang_v1";
  var TOPIC_KEY = "newstv_googlenews_topic_v1";
  var QUERY_KEY = "newstv_googlenews_query_v1";
  var PINS_KEY = "newstv_googlenews_pins_v1";
  var SIDE_KEY = "newstv_googlenews_side_collapsed";

  var DEFAULT_CODE = "EG"; // matches the app's Arabic-first default
  var DEFAULT_TOPIC = "top";
  var DEFAULT_PINS = ["EG", "SA", "AE", "US", "GB", "UA"];
  var POPULAR = ["EG", "SA", "AE", "US", "GB", "UA", "IL", "IR"];

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

  function label(country) {
    return (country.flag ? country.flag + " " : "") + country.name;
  }

  // -- persistence (mirror of the app's localStorage pattern) ------------
  function lsGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function lsSet(key, val) {
    try { localStorage.setItem(key, val); } catch (e) { /* private mode — just won't persist */ }
  }

  function loadPins() {
    try {
      var raw = localStorage.getItem(PINS_KEY);
      if (raw === null) { savePins(DEFAULT_PINS); return DEFAULT_PINS.slice(); }
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return DEFAULT_PINS.slice();
    }
  }
  function savePins(arr) {
    try { localStorage.setItem(PINS_KEY, JSON.stringify(arr)); } catch (e) {}
  }

  function init(mountEl) {
    if (!mountEl || mountEl.dataset.gnInit === "1") return;
    mountEl.dataset.gnInit = "1";

    var g = typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : this;
    var COUNTRIES = g.GOOGLE_NEWS_COUNTRIES;
    var SEARCH = g.LiveuamapSearch;
    var URL = g.GoogleNewsUrl;
    if (!COUNTRIES || !SEARCH || !URL) {
      mountEl.appendChild(el("div", {
        class: "empty",
        text: "Google News failed to load (missing data/googleNewsCountries.js, lib/liveuamapSearch.js or lib/googleNewsUrl.js).",
      }));
      return;
    }

    function byCode(code) {
      if (!code) return null;
      var c = String(code).toUpperCase();
      for (var i = 0; i < COUNTRIES.length; i++) if (COUNTRIES[i].code === c) return COUNTRIES[i];
      return null;
    }
    function topicLabel(id) {
      for (var i = 0; i < URL.TOPICS.length; i++) if (URL.TOPICS[i].id === id) return URL.TOPICS[i].label;
      return "Top Stories";
    }
    function langLabel(code) {
      for (var i = 0; i < URL.LANGS.length; i++) if (URL.LANGS[i].code === code) return URL.LANGS[i].label;
      return code;
    }

    // ---- state (restored from localStorage) -------------------------
    var current = byCode(lsGet(COUNTRY_KEY)) || byCode(DEFAULT_CODE) || COUNTRIES[0];
    var lang = URL.isLang(lsGet(LANG_KEY)) ? lsGet(LANG_KEY) : URL.DEFAULT_LANG;
    var topic = URL.isTopic(lsGet(TOPIC_KEY)) ? lsGet(TOPIC_KEY) : DEFAULT_TOPIC;
    var query = lsGet(QUERY_KEY) || "";
    var pins = loadPins();
    var results = [];
    var highlight = 0;

    function targetUrl() {
      return URL.build({ code: current ? current.code : URL.DEFAULT_CODE, lang: lang, topic: topic, query: query });
    }
    function openInTab() {
      window.open(targetUrl(), "_blank", "noopener,noreferrer");
    }

    // ---- DOM skeleton ---------------------------------------------------
    var input = el("input", {
      type: "search",
      id: "gnSearch",
      placeholder: "Search country… e.g. egy, usa, ukr",
      "aria-label": "Search country",
      autocomplete: "off",
      role: "combobox",
      "aria-expanded": "false",
    });
    var resultsBox = el("div", { class: "lu-results", id: "gnResults", role: "listbox", hidden: "" });
    var popularWrap = el("div", { class: "lu-section", id: "gnPopular" });
    var pinsWrap = el("div", { class: "lu-section", id: "gnPinsSection" });

    var langSel = el("select", { class: "hdrbtn gn-select", "aria-label": "News language", title: "News language" },
      URL.LANGS.map(function (l) { return el("option", { value: l.code }, [l.label]); }));
    langSel.value = lang;
    var topicSel = el("select", { class: "hdrbtn gn-select", "aria-label": "Topic", title: "Topic" },
      URL.TOPICS.map(function (t) { return el("option", { value: t.id }, [t.label]); }));
    topicSel.value = topic;
    var queryInput = el("input", {
      type: "search",
      class: "gn-query",
      id: "gnQuery",
      placeholder: "Search news… e.g. Egypt economy",
      "aria-label": "Custom news search",
      autocomplete: "off",
    });
    queryInput.value = query;

    var settingsWrap = el("div", { class: "lu-section", id: "gnSettings" }, [
      el("div", { class: "gn-field" }, [el("label", { for: "gnQuery", text: "Custom search" }), queryInput]),
      el("div", { class: "gn-field" }, [el("label", { text: "Language" }), langSel]),
      el("div", { class: "gn-field" }, [el("label", { text: "Topic" }), topicSel]),
    ]);

    var side = el("div", { class: "lu-side" }, [
      el("div", { class: "lu-searchbox" }, [input]),
      el("div", { class: "lu-scroll" }, [popularWrap, pinsWrap, resultsBox, settingsWrap]),
    ]);

    var currentLabel = el("span", { class: "lu-current" });
    var pinBtn = el("button", { class: "hdrbtn lu-pin", type: "button", title: "Pin / unpin this country" });
    var resetBtn = el("button", { class: "hdrbtn", type: "button", text: "Reset" });
    var openBtn = el("button", { class: "hdrbtn lu-open", type: "button", text: "Open in New Tab ↗" });
    var worldMapBtn = el("button", { class: "hdrbtn", type: "button", text: "🗺️ World Map ↗", title: "Open this country on the World Map tab" });
    var bar = el("div", { class: "lu-bar" }, [
      currentLabel, el("span", { class: "lu-bar-spacer" }), worldMapBtn, pinBtn, resetBtn, openBtn,
    ]);
    var frame = el("div", { class: "lu-frame", id: "gnFrame" });
    var mapWrap = el("div", { class: "lu-mapwrap" }, [bar, frame]);

    // Left-panel collapse toggle — same chevron/markup/classes as World Map,
    // so desktop "Hide panel" and mobile fullscreen "Hide list" work for free.
    var toggleBtn = el("button", {
      class: "lu-toggle",
      type: "button",
      "aria-label": "Toggle panel",
      html:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>' +
        '<span class="lu-toggle-label"></span>',
    });
    var sideCollapsed = lsGet(SIDE_KEY) === "1";
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
      lsSet(SIDE_KEY, sideCollapsed ? "1" : "0");
    });

    mountEl.appendChild(side);
    mountEl.appendChild(mapWrap);
    mountEl.appendChild(toggleBtn);

    // ---- rendering ----------------------------------------------------
    function chip(country, opts) {
      opts = opts || {};
      var b = el("button", {
        class: "lu-chip" + (current && current.code === country.code ? " active" : ""),
        type: "button",
        onclick: function () { openCountry(country); },
      }, [document.createTextNode(label(country))]);
      if (opts.unpin) {
        b.appendChild(el("span", {
          class: "lu-chip-x",
          title: "Remove from watchlist",
          text: "×",
          onclick: function (e) { e.stopPropagation(); togglePin(country.code); },
        }));
      }
      return b;
    }

    function renderPopular() {
      popularWrap.replaceChildren(el("div", { class: "lu-section-title", text: "Popular" }));
      var row = el("div", { class: "lu-chips" });
      POPULAR.forEach(function (code) {
        var c = byCode(code);
        if (c) row.appendChild(chip(c));
      });
      popularWrap.appendChild(row);
    }

    function renderPins() {
      pinsWrap.replaceChildren(el("div", { class: "lu-section-title", text: "Watchlist" }));
      var known = pins.map(byCode).filter(Boolean);
      if (!known.length) {
        pinsWrap.appendChild(el("div", { class: "lu-hint", text: "No pinned countries. Load one and press ☆ to pin it." }));
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
          class: "lu-result" + (i === highlight ? " hl" : "") + (current && current.code === c.code ? " active" : ""),
          role: "option",
          "aria-selected": i === highlight ? "true" : "false",
          onclick: function () { openCountry(c); },
          onmousemove: function () {
            if (highlight !== i) { highlight = i; paintHighlight(); }
          },
        }, [
          el("span", { class: "lu-result-flag", text: c.flag || "•" }),
          el("span", { class: "lu-result-name", text: c.name }),
        ]);
        resultsBox.appendChild(row);
      });
    }

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
      input.setAttribute("aria-expanded", "false");
    }
    function showResultsState() {
      resultsBox.hidden = false;
      popularWrap.hidden = true;
      pinsWrap.hidden = true;
      input.setAttribute("aria-expanded", "true");
    }

    function renderBar() {
      currentLabel.textContent = current ? "Currently: " + label(current) : "Pick a country";
      var pinned = current && pins.indexOf(current.code) !== -1;
      pinBtn.textContent = pinned ? "★ Pinned" : "☆ Pin";
      pinBtn.classList.toggle("on", !!pinned);
      pinBtn.hidden = !current;
      worldMapBtn.hidden = !(
        current && current.luSlug &&
        g.LiveuamapExplorer && typeof g.LiveuamapExplorer.openCountryBySlug === "function"
      );
    }

    // The "view": Google News blocks embedding, so this is a launch panel, not
    // an iframe. Re-rendered on every country / language / topic / query change.
    function renderView() {
      var url = targetUrl();
      var sub = langLabel(lang) + " · " + (query.trim() ? "Search: “" + query.trim() + "”" : topicLabel(topic));
      frame.replaceChildren(el("div", { class: "empty gn-panel" }, [
        el("div", { class: "gn-panel-head" }, [
          el("span", { class: "gn-panel-flag", text: current ? current.flag || "🌐" : "🌐" }),
          el("strong", { text: current ? current.name : "Google News" }),
        ]),
        el("div", { class: "gn-panel-sub", text: sub }),
        el("div", { class: "gn-url", text: url }),
        el("div", { class: "gn-panel-actions" }, [
          el("button", { class: "hdrbtn gn-go", type: "button", text: "Open Google News ↗", onclick: openInTab }),
        ]),
        el("div", { class: "gn-panel-note", text: "Google News blocks embedding, so it opens in a new tab." }),
      ]));
    }

    function refreshChrome() {
      renderPopular();
      renderPins();
      renderBar();
      renderResults();
      renderView();
    }

    // ---- actions ----------------------------------------------------
    function runSearch() {
      var q = input.value;
      if (!q.trim()) {
        results = [];
        showEmptyState();
        return;
      }
      results = SEARCH.searchCountries(q, COUNTRIES);
      highlight = 0;
      renderResults();
      showResultsState();
    }

    function openCountry(country) {
      if (!country) return;
      current = country;
      lsSet(COUNTRY_KEY, country.code);
      input.value = "";
      results = [];
      showEmptyState();
      refreshChrome();
    }

    function setLang(code) {
      lang = URL.isLang(code) ? code : URL.DEFAULT_LANG;
      langSel.value = lang;
      lsSet(LANG_KEY, lang);
      renderView();
    }
    function setTopic(id) {
      topic = URL.isTopic(id) ? id : DEFAULT_TOPIC;
      topicSel.value = topic;
      lsSet(TOPIC_KEY, topic);
      renderView();
    }
    function setQuery(str) {
      query = str || "";
      lsSet(QUERY_KEY, query);
      renderView();
    }

    function togglePin(code) {
      var i = pins.indexOf(code);
      if (i === -1) pins.push(code);
      else pins.splice(i, 1);
      savePins(pins);
      renderPins();
      renderBar();
      renderResults();
    }

    function reset() {
      setLang(URL.DEFAULT_LANG);
      setTopic(DEFAULT_TOPIC);
      queryInput.value = "";
      setQuery("");
      openCountry(byCode(DEFAULT_CODE) || COUNTRIES[0]);
      input.value = "";
      results = [];
      showEmptyState();
      try { input.focus(); } catch (e) {}
    }

    function goWorldMap() {
      if (!current || !current.luSlug) return;
      var tab = document.getElementById("tabWorldMap");
      if (tab) tab.click();
      var LX = g.LiveuamapExplorer;
      if (LX && typeof LX.openCountryBySlug === "function") LX.openCountryBySlug(current.luSlug);
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
    queryInput.addEventListener("input", function () { setQuery(queryInput.value); });
    langSel.addEventListener("change", function () { setLang(langSel.value); });
    topicSel.addEventListener("change", function () { setTopic(topicSel.value); });
    pinBtn.addEventListener("click", function () { if (current) togglePin(current.code); });
    resetBtn.addEventListener("click", reset);
    openBtn.addEventListener("click", openInTab);
    worldMapBtn.addEventListener("click", goWorldMap);

    // ---- first paint ------------------------------------------------
    applySideState(sideCollapsed);
    showEmptyState();
    refreshChrome();
    setTimeout(function () { try { input.focus(); } catch (e) {} }, 0);
  }

  return { init: init };
});
