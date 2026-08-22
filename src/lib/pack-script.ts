export function buildPackScript(opts: { token: string; origin: string }): string {
  const token = JSON.stringify(opts.token);
  const origin = JSON.stringify(opts.origin);

  return `/* Signal pack v0.1.0 — deterministic SEO/AIO beacon */
(function () {
  "use strict";
  var TOKEN = ${token};
  var API_ORIGIN = ${origin};
  var PACK_VERSION = "0.1.0";

  function text(el) {
    return el ? (el.textContent || "").trim() : "";
  }

  function meta(name) {
    var el = document.querySelector('meta[name="' + name + '"]');
    return el ? el.getAttribute("content") || "" : "";
  }

  function metaProp(name) {
    var el = document.querySelector('meta[property="' + name + '"]');
    return el ? el.getAttribute("content") || "" : "";
  }

  function collect() {
    var title = (document.title || "").trim();
    var description = meta("description");
    var canonicalLink = document.querySelector('link[rel="canonical"]');
    var canonical = canonicalLink ? canonicalLink.getAttribute("href") || "" : "";
    var h1Els = document.querySelectorAll("h1");
    var h1Texts = [];
    for (var i = 0; i < h1Els.length; i++) h1Texts.push(text(h1Els[i]).slice(0, 200));

    var bodyText = document.body ? document.body.innerText || "" : "";
    var words = bodyText.split(/\\s+/).filter(function (w) { return w.length > 0; });
    var questions = (bodyText.match(/\\?/g) || []).length;
    var definitionPattern = /\\b(is|means|refers to)\\b/i.test(bodyText);

    var imgs = document.querySelectorAll("img");
    var imagesWithAlt = 0;
    for (var j = 0; j < imgs.length; j++) {
      var alt = imgs[j].getAttribute("alt");
      if (alt && alt.trim()) imagesWithAlt++;
    }

    var links = document.querySelectorAll("a[href]");
    var internalLinks = 0;
    var externalLinks = 0;
    var host = location.hostname;
    var linksWithoutText = 0;
    for (var k = 0; k < links.length; k++) {
      var href = links[k].getAttribute("href") || "";
      var linkText = text(links[k]);
      var aria = links[k].getAttribute("aria-label") || "";
      if (!linkText && !aria) linksWithoutText++;
      if (href.indexOf("/") === 0 || href.indexOf("#") === 0 || href.indexOf("?") === 0) {
        internalLinks++;
      } else {
        try {
          if (new URL(href, location.href).hostname === host) internalLinks++;
          else externalLinks++;
        } catch (e) {
          internalLinks++;
        }
      }
    }

    var inputs = document.querySelectorAll("input, select, textarea");
    var inputsWithoutLabels = 0;
    for (var m = 0; m < inputs.length; m++) {
      var input = inputs[m];
      var id = input.getAttribute("id");
      var hasLabel = id && document.querySelector('label[for="' + id + '"]');
      var hasAria = input.getAttribute("aria-label") || input.getAttribute("aria-labelledby");
      if (!hasLabel && !hasAria) inputsWithoutLabels++;
    }

    var scripts = document.querySelectorAll('script[type="application/ld+json"]');
    var schemaTypes = [];
    var hasFAQ = false;
    var hasHowTo = false;
    for (var n = 0; n < scripts.length; n++) {
      try {
        var json = JSON.parse(scripts[n].textContent || "{}");
        var nodes = Array.isArray(json) ? json : [json];
        if (json["@graph"]) nodes = json["@graph"];
        for (var p = 0; p < nodes.length; p++) {
          var t = nodes[p]["@type"];
          if (!t) continue;
          var types = Array.isArray(t) ? t : [t];
          for (var q = 0; q < types.length; q++) {
            schemaTypes.push(String(types[q]));
            if (String(types[q]).toLowerCase().indexOf("faq") !== -1) hasFAQ = true;
            if (String(types[q]).toLowerCase().indexOf("howto") !== -1) hasHowTo = true;
          }
        }
      } catch (e) {}
    }

    var sentences = bodyText.split(/[.!?]+/).filter(function (s) { return s.trim().length > 0; });
    var avgSentenceLength = 0;
    if (sentences.length) {
      var total = 0;
      for (var r = 0; r < sentences.length; r++) {
        total += sentences[r].trim().split(/\\s+/).filter(Boolean).length;
      }
      avgSentenceLength = Math.round(total / sentences.length);
    }

    var timing = performance && performance.timing ? performance.timing : null;
    var nav = performance && performance.getEntriesByType
      ? performance.getEntriesByType("navigation")[0]
      : null;
    var paint = performance && performance.getEntriesByType
      ? performance.getEntriesByType("paint")
      : [];
    var fcp = 0;
    for (var s = 0; s < paint.length; s++) {
      if (paint[s].name === "first-contentful-paint") fcp = Math.round(paint[s].startTime);
    }

    var depth = 0;
    (function walk(node, level) {
      if (level > depth) depth = level;
      var kids = node.children || [];
      for (var i = 0; i < kids.length; i++) walk(kids[i], level + 1);
    })(document.documentElement, 0);

    var semantic = document.querySelectorAll("main,nav,header,footer,article,section,aside").length;
    var allEls = document.getElementsByTagName("*").length || 1;

    return {
      token: TOKEN,
      url: location.href,
      timestamp: new Date().toISOString(),
      metadata: {
        title: title,
        description: description,
        canonical: canonical,
        ogTitle: metaProp("og:title"),
        ogDescription: metaProp("og:description"),
        ogImage: metaProp("og:image"),
        viewport: meta("viewport"),
        robots: meta("robots")
      },
      content: {
        wordCount: words.length,
        headings: {
          h1: document.querySelectorAll("h1").length,
          h2: document.querySelectorAll("h2").length,
          h3: document.querySelectorAll("h3").length,
          h4: document.querySelectorAll("h4").length,
          h5: document.querySelectorAll("h5").length,
          h6: document.querySelectorAll("h6").length
        },
        h1Texts: h1Texts,
        imagesCount: imgs.length,
        imagesWithAlt: imagesWithAlt,
        linksCount: links.length,
        internalLinksCount: internalLinks,
        externalLinksCount: externalLinks,
        questionCount: questions
      },
      structure: {
        hasDoctype: !!document.doctype,
        hasHtmlLang: !!(document.documentElement && document.documentElement.lang),
        hasMain: !!document.querySelector("main"),
        headingOrder: true,
        domDepth: depth,
        semanticRatio: Math.round((semantic / allEls) * 100)
      },
      performance: {
        firstContentfulPaint: fcp || (timing ? Math.max(0, timing.responseStart - timing.navigationStart) : undefined),
        largestContentfulPaint: nav ? Math.round(nav.loadEventEnd || 0) : undefined,
        domContentLoaded: timing ? Math.max(0, timing.domContentLoadedEventEnd - timing.navigationStart) : undefined,
        resourceCount: performance && performance.getEntriesByType
          ? performance.getEntriesByType("resource").length
          : undefined
      },
      accessibility: {
        imagesWithoutAlt: Math.max(0, imgs.length - imagesWithAlt),
        linksWithoutText: linksWithoutText,
        inputsWithoutLabels: inputsWithoutLabels,
        hasSkipLink: !!document.querySelector('a[href="#main"], a[href="#content"], .skip-link'),
        hasLandmarkRegions: semantic > 0
      },
      aio: {
        hasStructuredData: scripts.length > 0,
        structuredDataCount: scripts.length,
        schemaTypes: schemaTypes,
        hasFAQ: hasFAQ,
        hasHowTo: hasHowTo,
        hasClearDefinitions: definitionPattern,
        questionCount: questions,
        avgSentenceLength: avgSentenceLength
      }
    };
  }

  function send(payload) {
    var endpoint = API_ORIGIN + "/api/beacon?token=" + encodeURIComponent(TOKEN);
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

  function run() {
    try {
      send(collect());
    } catch (e) {
      if (window.__signalDebug) console.error("[Signal]", e);
    }
  }

  if (document.readyState === "complete") {
    setTimeout(run, 50);
  } else {
    window.addEventListener("load", function () { setTimeout(run, 50); });
  }
})();
`;
}
