// ---------------------------------------------------------------
// Verify every Liveuamap subdomain in data/liveuamapCountries.js
// (countries/regions and non-country topic maps alike).
//
//   node scripts/verifyLiveuamapCountries.js          # check verified:true entries
//   node scripts/verifyLiveuamapCountries.js --all     # check every entry
//
// For each slug it does a GET of https://<slug>.liveuamap.com/, follows
// redirects, and treats it as live only if:
//   - final status is 200
//   - final host ends in .liveuamap.com
//   - the body has a <title>
//
// Prints a table, then a summary of any mismatch between the result and the
// `verified` flag in the dataset. Exits non-zero if the dataset claims a slug
// is verified but it failed the check (so CI can catch link rot).
//
// Requires Node 18+ (global fetch).
// ---------------------------------------------------------------
var COUNTRIES = require("../data/liveuamapCountries.js");

var checkAll = process.argv.includes("--all");
var UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
var TIMEOUT_MS = 20000;

async function check(slug) {
  var url = "https://" + slug + ".liveuamap.com/";
  var ctrl = new AbortController();
  var t = setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS);
  try {
    var res = await fetch(url, { redirect: "follow", headers: { "user-agent": UA }, signal: ctrl.signal });
    var body = await res.text();
    var finalHost = new URL(res.url).host;
    var titleMatch = body.match(/<title[^>]*>([^<]*)<\/title>/i);
    var ok =
      res.status === 200 &&
      /(^|\.)liveuamap\.com$/.test(finalHost) &&
      !!titleMatch;
    return {
      slug: slug,
      ok: ok,
      status: res.status,
      finalUrl: res.url,
      title: titleMatch ? titleMatch[1].trim().slice(0, 70) : "(no <title>)",
    };
  } catch (e) {
    return { slug: slug, ok: false, status: 0, finalUrl: url, title: "ERROR: " + e.message };
  } finally {
    clearTimeout(t);
  }
}

(async function main() {
  var entries = COUNTRIES.filter(function (c) { return checkAll || c.verified === true; });
  console.log("Checking " + entries.length + " subdomain(s)...\n");

  var results = [];
  for (var i = 0; i < entries.length; i++) {
    var c = entries[i];
    /* eslint-disable no-await-in-loop */
    var r = await check(c.slug);
    r.claimedVerified = c.verified === true;
    r.name = c.name;
    results.push(r);
    console.log(
      (r.ok ? "  OK   " : "  DEAD ") +
        r.slug.padEnd(18) +
        String(r.status).padEnd(4) +
        r.title
    );
  }

  var falsePositives = results.filter(function (r) { return r.claimedVerified && !r.ok; });
  var couldPromote = results.filter(function (r) { return !r.claimedVerified && r.ok; });

  console.log("\n--- summary ---");
  console.log("live: " + results.filter(function (r) { return r.ok; }).length + " / " + results.length);

  if (falsePositives.length) {
    console.log("\n!! dataset says verified:true but the check FAILED for:");
    falsePositives.forEach(function (r) { console.log("   - " + r.slug + " (" + r.name + ")  " + r.finalUrl); });
  }
  if (checkAll && couldPromote.length) {
    console.log("\n?? verified:false but the subdomain works — consider promoting:");
    couldPromote.forEach(function (r) { console.log("   - " + r.slug + " (" + r.name + ")  -> " + r.finalUrl); });
  }
  if (!falsePositives.length) console.log("\nAll verified:true entries resolve. OK.");

  process.exit(falsePositives.length ? 1 : 0);
})();
