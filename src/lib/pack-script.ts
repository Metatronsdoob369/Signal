export const PACK_VERSION = "0.2.1";

/** Byte budget for the served pack. Collectors that push past this need a reason. */
export const PACK_MAX_BYTES = 24_576;

/**
 * The pack is a thin collector. It ships counts, booleans, bounded enumerations and the
 * head metadata search engines already index. Verdicts (heading hierarchy, schema
 * completeness, answer-first shape) are derived server-side from these observations.
 * Body prose never leaves the page: word, sentence and definition counts are computed
 * locally and only the numbers travel.
 */
export function buildPackScript(opts: { key: string; origin: string }): string {
  const key = JSON.stringify(opts.key);
  const origin = JSON.stringify(opts.origin);

  return `/* Signal pack v${PACK_VERSION} — deterministic SEO/AIO beacon */
(function () {
  "use strict";
  var KEY = ${key};
  var API_ORIGIN = ${origin};
  var PACK_VERSION = ${JSON.stringify(PACK_VERSION)};

  // "How do you verify Signal" is a question; "What this page includes" is a noun phrase.
  var QUESTION_START = /^(?:(?:what|why|how|when|where|who|whom|whose|which)\\s+(?:is|are|was|were|do|does|did|can|could|should|would|will|to|much|many|long|often|about)\\b|(?:can|could|should|would|does|do|did|is|are|will)\\s)/i;
  var SUMMARY_HEAD = /^(summary|key takeaways|tl;?dr|in short|at a glance|overview|quick answer|the short answer|bottom line)\\b/i;
  var GENERIC_ANCHOR = /^(click here|here|read more|more|learn more|link|this|continue|details|see more)$/;
  var DEFINITION = /^(?:the\\s|a\\s|an\\s)?[A-Z][A-Za-z0-9\\-']{1,40}(?:\\s[A-Za-z0-9\\-']{1,40}){0,4}\\s(?:is|are)\\s(?:a|an|the)\\s|\\b(?:is defined as|refers to|is a type of|is a kind of)\\b/;
  var ENTITY_KEYS = ["publisher", "author", "provider", "brand", "isPartOf"];

  function text(el) {
    return el ? (el.textContent || "").replace(/\\s+/g, " ").trim() : "";
  }

  function words(s) {
    return s.split(/\\s+/).filter(function (w) { return w.length > 0; });
  }

  function meta(name) {
    var el = document.querySelector('meta[name="' + name + '"]');
    return el ? (el.getAttribute("content") || "").slice(0, 2000) : "";
  }

  function metaProp(name) {
    var el = document.querySelector('meta[property="' + name + '"]');
    return el ? (el.getAttribute("content") || "").slice(0, 2000) : "";
  }

  function hostOf(href) {
    try { return new URL(href, location.href).hostname.replace(/^www\\./, ""); } catch (e) { return ""; }
  }

  function isQuestion(t) {
    return /\\?\\s*$/.test(t) || QUESTION_START.test(t);
  }

  function answerWordsAfter(heading) {
    var n = heading.nextElementSibling;
    var hops = 0;
    while (n && hops < 4) {
      var tag = n.tagName;
      if (tag === "P") return words(text(n)).length;
      if (tag === "DIV" || tag === "SPAN") {
        var p = n.querySelector("p");
        if (p) return words(text(p)).length;
      } else if (/^(H[1-6]|UL|OL|TABLE|SECTION|ARTICLE|ASIDE|FOOTER)$/.test(tag)) {
        return 0;
      }
      n = n.nextElementSibling;
      hops++;
    }
    return 0;
  }

  var pageHost = location.hostname.replace(/^www\\./, "");
  var lcp = 0;
  var cls = 0;
  var clsSupported = false;
  var inp = 0;
  var inpSupported = false;

  try {
    new PerformanceObserver(function (list) {
      var es = list.getEntries();
      if (es.length) lcp = es[es.length - 1].startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
  } catch (e) {}
  try {
    new PerformanceObserver(function (list) {
      var es = list.getEntries();
      for (var i = 0; i < es.length; i++) if (!es[i].hadRecentInput) cls += es[i].value;
    }).observe({ type: "layout-shift", buffered: true });
    clsSupported = true;
  } catch (e) {}
  try {
    new PerformanceObserver(function (list) {
      var es = list.getEntries();
      for (var i = 0; i < es.length; i++) if (es[i].interactionId && es[i].duration > inp) inp = es[i].duration;
    }).observe({ type: "event", buffered: true, durationThreshold: 40 });
    inpSupported = true;
  } catch (e) {}

  function collectHeadings() {
    var els = document.querySelectorAll("h1,h2,h3,h4,h5,h6");
    var levels = [];
    var empty = 0;
    var questions = 0;
    var answers = [];
    var summary = false;
    var h1Texts = [];
    for (var i = 0; i < els.length; i++) {
      var h = els[i];
      var level = parseInt(h.tagName.charAt(1), 10);
      if (levels.length < 200) levels.push(level);
      var ht = text(h);
      if (level === 1 && h1Texts.length < 10) h1Texts.push(ht.slice(0, 200));
      if (!ht) { empty++; continue; }
      if (SUMMARY_HEAD.test(ht)) summary = true;
      if (isQuestion(ht)) {
        questions++;
        if (answers.length < 60) answers.push(answerWordsAfter(h));
      }
    }
    return { levels: levels, empty: empty, questions: questions, answers: answers, summary: summary, h1Texts: h1Texts };
  }

  function collectSchema() {
    var scripts = document.querySelectorAll('script[type="application/ld+json"]');
    var types = [];
    var nodes = [];
    var errors = 0;
    var hasFAQ = false;
    var hasHowTo = false;

    function record(node) {
      if (!node || typeof node !== "object" || Array.isArray(node)) return;
      var t = node["@type"];
      if (t) {
        var list = Array.isArray(t) ? t : [t];
        for (var q = 0; q < list.length; q++) {
          var name = String(list[q]).slice(0, 80);
          if (types.length < 32) types.push(name);
          var lower = name.toLowerCase();
          if (lower.indexOf("faq") !== -1) hasFAQ = true;
          if (lower.indexOf("howto") !== -1) hasHowTo = true;
        }
        if (nodes.length < 32) {
          var keys = [];
          for (var k in node) {
            if (Object.prototype.hasOwnProperty.call(node, k) && k.charAt(0) !== "@" && keys.length < 40) {
              keys.push(String(k).slice(0, 40));
            }
          }
          nodes.push({ type: String(list[0]).slice(0, 80), keys: keys });
        }
      }
      for (var e = 0; e < ENTITY_KEYS.length; e++) {
        var nested = node[ENTITY_KEYS[e]];
        if (nested && typeof nested === "object" && !Array.isArray(nested) && nested["@type"]) record(nested);
      }
    }

    for (var i = 0; i < scripts.length; i++) {
      var json;
      try { json = JSON.parse(scripts[i].textContent || ""); } catch (e) { errors++; continue; }
      var roots = Array.isArray(json) ? json : [json];
      for (var r = 0; r < roots.length; r++) {
        var root = roots[r];
        if (root && root["@graph"] && Array.isArray(root["@graph"])) {
          for (var g = 0; g < root["@graph"].length; g++) record(root["@graph"][g]);
        }
        record(root);
      }
    }
    return { count: scripts.length, types: types, nodes: nodes, errors: errors, hasFAQ: hasFAQ, hasHowTo: hasHowTo };
  }

  function collectProse() {
    var bodyText = document.body ? (document.body.innerText || document.body.textContent || "") : "";
    var all = words(bodyText);
    var questionMarks = (bodyText.match(/\\?/g) || []).length;
    var sentences = bodyText.split(/[.!?]+(?:\\s|$)/).filter(function (s) { return s.trim().length > 10; });
    var totalWords = 0;
    var definitions = 0;
    for (var i = 0; i < sentences.length; i++) {
      var s = sentences[i].trim();
      totalWords += words(s).length;
      if (DEFINITION.test(s)) definitions++;
    }
    var paragraphs = document.querySelectorAll("p");
    var pWords = 0;
    for (var j = 0; j < paragraphs.length; j++) pWords += words(text(paragraphs[j])).length;
    return {
      wordCount: all.length,
      questionMarks: questionMarks,
      sentenceCount: sentences.length,
      avgSentenceLength: sentences.length ? Math.round(totalWords / sentences.length) : 0,
      definitions: definitions,
      paragraphCount: paragraphs.length,
      avgParagraphWords: paragraphs.length ? Math.round(pWords / paragraphs.length) : 0
    };
  }

  function collectLinks() {
    var links = document.querySelectorAll("a[href]");
    var internal = 0;
    var external = 0;
    var withoutText = 0;
    var generic = 0;
    for (var k = 0; k < links.length; k++) {
      var a = links[k];
      var href = a.getAttribute("href") || "";
      var label = text(a);
      var aria = a.getAttribute("aria-label") || "";
      if (!label && !aria && !a.querySelector("img[alt]")) withoutText++;
      if (label && GENERIC_ANCHOR.test(label.toLowerCase())) generic++;
      if (href.indexOf("/") === 0 || href.indexOf("#") === 0 || href.indexOf("?") === 0 || !href) {
        internal++;
      } else {
        var host = hostOf(href);
        if (!host || host === pageHost) internal++;
        else external++;
      }
    }
    return { total: links.length, internal: internal, external: external, withoutText: withoutText, generic: generic };
  }

  function collectMedia() {
    var imgs = document.querySelectorAll("img");
    var withAlt = 0;
    var withDims = 0;
    var lazy = 0;
    for (var j = 0; j < imgs.length; j++) {
      var img = imgs[j];
      var alt = img.getAttribute("alt");
      if (alt !== null && alt.trim()) withAlt++;
      if (img.getAttribute("width") && img.getAttribute("height")) withDims++;
      if ((img.getAttribute("loading") || "").toLowerCase() === "lazy") lazy++;
    }
    return { total: imgs.length, withAlt: withAlt, withDims: withDims, lazy: lazy };
  }

  function collectForms() {
    var inputs = document.querySelectorAll("input:not([type=hidden]), select, textarea");
    var unlabeled = 0;
    for (var m = 0; m < inputs.length; m++) {
      var input = inputs[m];
      var id = input.getAttribute("id");
      var safeId = id && window.CSS && CSS.escape ? CSS.escape(id) : id;
      var hasLabel = safeId && document.querySelector('label[for="' + safeId + '"]');
      var wrapped = input.closest && input.closest("label");
      var hasAria = input.getAttribute("aria-label") || input.getAttribute("aria-labelledby");
      if (!hasLabel && !wrapped && !hasAria) unlabeled++;
    }
    var buttons = document.querySelectorAll("button");
    var mute = 0;
    for (var b = 0; b < buttons.length; b++) {
      var btn = buttons[b];
      if (!text(btn) && !btn.getAttribute("aria-label") && !btn.getAttribute("aria-labelledby") && !btn.querySelector("img[alt]")) mute++;
    }
    return { unlabeled: unlabeled, muteButtons: mute };
  }

  function collectScripts() {
    var head = document.head;
    var blocking = head ? head.querySelectorAll('script[src]:not([async]):not([defer]):not([type="module"])').length : 0;
    var all = document.querySelectorAll("script[src]");
    var thirdParty = 0;
    for (var i = 0; i < all.length; i++) {
      var host = hostOf(all[i].getAttribute("src") || "");
      if (host && host !== pageHost) thirdParty++;
    }
    return { blocking: blocking, thirdParty: thirdParty };
  }

  function collectPerformance() {
    var perf = window.performance;
    var hasEntries = perf && typeof perf.getEntriesByType === "function";
    var nav = hasEntries ? perf.getEntriesByType("navigation")[0] : null;
    var timing = perf && perf.timing ? perf.timing : null;
    var paint = hasEntries ? perf.getEntriesByType("paint") : [];
    var resources = hasEntries ? perf.getEntriesByType("resource") : [];
    var fcp = 0;
    for (var s = 0; s < paint.length; s++) {
      if (paint[s].name === "first-contentful-paint") fcp = paint[s].startTime;
    }
    var ttfb = nav ? nav.responseStart : (timing ? timing.responseStart - timing.navigationStart : 0);
    var dcl = nav ? nav.domContentLoadedEventEnd : (timing ? timing.domContentLoadedEventEnd - timing.navigationStart : 0);
    var transfer = nav && nav.transferSize ? nav.transferSize : 0;
    var mixed = 0;
    for (var r = 0; r < resources.length; r++) {
      transfer += resources[r].transferSize || 0;
      if (location.protocol === "https:" && String(resources[r].name).indexOf("http:") === 0) mixed++;
    }
    var out = {};
    if (ttfb > 0) out.timeToFirstByte = Math.round(ttfb);
    if (fcp > 0) out.firstContentfulPaint = Math.round(fcp);
    if (lcp > 0) out.largestContentfulPaint = Math.round(lcp);
    if (dcl > 0) out.domContentLoaded = Math.round(dcl);
    if (clsSupported) out.cumulativeLayoutShift = Math.round(cls * 1000) / 1000;
    if (inpSupported && inp > 0) out.interactionToNextPaint = Math.round(inp);
    if (hasEntries) out.resourceCount = resources.length;
    if (transfer > 0) out.transferBytes = Math.round(transfer);
    return { metrics: out, mixed: mixed, hasEntries: hasEntries };
  }

  function collect() {
    var headings = collectHeadings();
    var schema = collectSchema();
    var prose = collectProse();
    var links = collectLinks();
    var media = collectMedia();
    var forms = collectForms();
    var scripts = collectScripts();
    var perf = collectPerformance();
    var canonicalLink = document.querySelector('link[rel="canonical"]');

    var depth = 0;
    (function walk(node, level) {
      if (level > depth) depth = level;
      var kids = node.children || [];
      for (var i = 0; i < kids.length; i++) walk(kids[i], level + 1);
    })(document.documentElement, 0);

    var semantic = document.querySelectorAll("main,nav,header,footer,article,section,aside,figure,time,address").length;
    var allEls = document.getElementsByTagName("*").length || 1;

    return {
      key: KEY,
      url: location.href,
      timestamp: new Date().toISOString(),
      packVersion: PACK_VERSION,
      metadata: {
        title: (document.title || "").trim().slice(0, 500),
        description: meta("description"),
        canonical: canonicalLink ? (canonicalLink.getAttribute("href") || "").slice(0, 2048) : "",
        ogTitle: metaProp("og:title").slice(0, 500),
        ogDescription: metaProp("og:description"),
        ogImage: metaProp("og:image"),
        ogUrl: metaProp("og:url"),
        twitterCard: meta("twitter:card").slice(0, 64),
        viewport: meta("viewport").slice(0, 200),
        robots: meta("robots").slice(0, 200),
        author: meta("author").slice(0, 200),
        publishedTime: metaProp("article:published_time").slice(0, 64),
        modifiedTime: metaProp("article:modified_time").slice(0, 64),
        hreflangCount: document.querySelectorAll('link[rel="alternate"][hreflang]').length
      },
      content: {
        wordCount: prose.wordCount,
        headings: {
          h1: document.querySelectorAll("h1").length,
          h2: document.querySelectorAll("h2").length,
          h3: document.querySelectorAll("h3").length,
          h4: document.querySelectorAll("h4").length,
          h5: document.querySelectorAll("h5").length,
          h6: document.querySelectorAll("h6").length
        },
        h1Texts: headings.h1Texts,
        headingLevels: headings.levels,
        emptyHeadingCount: headings.empty,
        questionHeadingCount: headings.questions,
        questionAnswerWords: headings.answers,
        hasSummaryBlock: headings.summary,
        paragraphCount: prose.paragraphCount,
        avgParagraphWords: prose.avgParagraphWords,
        listCount: document.querySelectorAll("ul,ol").length,
        tableCount: document.querySelectorAll("table").length,
        sentenceCount: prose.sentenceCount,
        definitionSentenceCount: prose.definitions,
        imagesCount: media.total,
        imagesWithAlt: media.withAlt,
        imagesWithDimensions: media.withDims,
        imagesLazy: media.lazy,
        linksCount: links.total,
        internalLinksCount: links.internal,
        externalLinksCount: links.external,
        genericAnchorCount: links.generic,
        questionCount: prose.questionMarks,
        timeElementCount: document.querySelectorAll("time[datetime]").length,
        hasByline: !!document.querySelector('[rel~="author"],[itemprop="author"],.byline,.author,[class*="byline"]')
      },
      structure: {
        hasDoctype: !!document.doctype,
        hasHtmlLang: !!(document.documentElement && document.documentElement.lang),
        hasMain: !!document.querySelector("main,[role=main]"),
        headingOrder: true,
        domDepth: depth,
        semanticRatio: Math.round((semantic / allEls) * 100),
        headScriptsBlocking: scripts.blocking,
        thirdPartyScriptCount: scripts.thirdParty,
        mixedContentCount: perf.mixed
      },
      performance: perf.metrics,
      accessibility: {
        imagesWithoutAlt: Math.max(0, media.total - media.withAlt),
        linksWithoutText: links.withoutText,
        buttonsWithoutText: forms.muteButtons,
        inputsWithoutLabels: forms.unlabeled,
        hasSkipLink: !!document.querySelector('a[href="#main"], a[href="#content"], .skip-link'),
        hasLandmarkRegions: semantic > 0
      },
      aio: {
        hasStructuredData: schema.count > 0,
        structuredDataCount: schema.count,
        schemaTypes: schema.types,
        schemaNodes: schema.nodes,
        schemaParseErrors: schema.errors,
        hasFAQ: schema.hasFAQ,
        hasHowTo: schema.hasHowTo,
        hasClearDefinitions: prose.definitions > 0,
        questionCount: prose.questionMarks,
        avgSentenceLength: prose.avgSentenceLength
      }
    };
  }

  function send(payload) {
    var endpoint = API_ORIGIN + "/api/beacon?key=" + encodeURIComponent(KEY);
    var body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      try {
        var blob = new Blob([body], { type: "application/json" });
        if (navigator.sendBeacon(endpoint, blob)) return;
      } catch (e) {}
    }
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body,
      keepalive: true,
      mode: "cors"
    }).catch(function () {});
  }

  var variantId = null;
  var startedAt = Date.now();
  var maxScroll = 0;
  var experimentSent = false;

  function applyVariant(v) {
    if (!v || v.error) return;
    variantId = v.variantId || null;
    if (v.title) document.title = v.title;
    if (v.description) {
      var m = document.querySelector('meta[name="description"]');
      if (!m) {
        m = document.createElement("meta");
        m.setAttribute("name", "description");
        (document.head || document.documentElement).appendChild(m);
      }
      m.setAttribute("content", v.description);
    }
  }

  window.addEventListener("scroll", function () {
    var h = document.documentElement;
    var pct = ((h.scrollTop || document.body.scrollTop) + window.innerHeight) / Math.max(h.scrollHeight, 1) * 100;
    if (pct > maxScroll) maxScroll = Math.min(100, pct);
  }, { passive: true });

  function engagementScore() {
    var dwell = (Date.now() - startedAt) / 1000;
    return Math.round((Math.min(1, maxScroll / 100) * 0.6 + Math.min(1, dwell / 45) * 0.4) * 100) / 100;
  }

  function run() {
    try {
      send(collect());
    } catch (e) {
      if (window.__signalDebug) console.error("[Signal]", e);
    }
  }

  function sendExperiment() {
    if (experimentSent || !variantId) return;
    experimentSent = true;
    send({
      key: KEY,
      url: location.href,
      intent: "experiment",
      variantId: variantId,
      events: [
        { type: "impression", value: 1 },
        { type: "engage", value: engagementScore() },
        { type: "vital", metric: "lcp", value: Math.round(lcp) },
        { type: "vital", metric: "cls", value: Math.round(cls * 1000) / 1000 }
      ]
    });
  }

  var auditStarted = false;

  function resolveThenAudit() {
    if (auditStarted) return;
    auditStarted = true;
    var descEl = document.querySelector('meta[name="description"]');
    var resolveUrl = API_ORIGIN + "/api/resolve?key=" + encodeURIComponent(KEY) +
      "&path=" + encodeURIComponent(location.pathname) +
      "&t=" + encodeURIComponent(document.title || "") +
      "&d=" + encodeURIComponent(descEl ? (descEl.getAttribute("content") || "") : "");
    fetch(resolveUrl, { mode: "cors" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (v) { applyVariant(v); })
      .catch(function () {})
      .then(function () { run(); });
  }

  window.addEventListener("pagehide", sendExperiment);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") sendExperiment();
  });

  if (document.readyState === "complete") {
    setTimeout(resolveThenAudit, 50);
  } else {
    window.addEventListener("load", function () { setTimeout(resolveThenAudit, 50); });
  }
})();
`;
}
