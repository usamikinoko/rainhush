(function () {
  var requestID = 0;
  var activeController = null;
  var prefetches = new Map();
  var parsedDocs = new Map();
  var prefetchReady = new Set();
  var prefetchAborters = new Map();
  var fetchTimeout = 8000;
  var exitDuration = 180;

  /* Scroll ownership. The browser's own history-scroll restoration is
     switched off: it snaps the viewport at popstate time, while the
     old page is still on screen. The router remembers where the
     reader left each page instead, and restores — invisibly, while
     the faded sheet is still up — between the exit animation and the
     content swap. sessionStorage backs this up across full reloads. */
  var scrollMemory = {};
  var lastHref = location.href;
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  function rememberScroll() {
    /* Keyed by the page being LEFT. location is already the target
       when popstate fires, so the router tracks the previous URL
       itself instead of reading location here. */
    scrollMemory[pageKey(new URL(lastHref))] = window.scrollY || 0;
    var keys = Object.keys(scrollMemory);
    if (keys.length > 40) delete scrollMemory[keys[0]];
  }

  function restoreScroll(key) {
    var saved = scrollMemory[key];
    if (typeof saved !== "number") {
      try { saved = +sessionStorage.getItem("scroll:" + key) || 0; } catch (e) { saved = 0; }
    }
    window.scrollTo(0, saved || 0);
  }

  window.addEventListener("pagehide", function () {
    try {
      sessionStorage.setItem("scroll:" + pageKey(new URL(location.href)), String(window.scrollY || 0));
    } catch (e) {}
  });

  function isNavigable(link, event) {
    if (!link || (link.target && link.target !== "_self") || link.hasAttribute("download")) return false;
    if (event && (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) return false;
    var url = new URL(link.href, location.href);
    if (url.origin !== location.origin || url.protocol !== location.protocol) return false;
    return url.pathname !== location.pathname || url.search !== location.search;
  }

  function pageKey(url) {
    var keyURL = new URL(url.href);
    keyURL.hash = "";
    return keyURL.href;
  }

  function fragmentURL(url) {
    var path = url.pathname;
    if (path.charAt(path.length - 1) === "/") path += "index.frag.html";
    else if (path.slice(-5) === ".html") path = path.slice(0, -5) + ".frag.html";
    else path += ".frag.html";
    var frag = new URL(url.href);
    frag.pathname = path;
    frag.search = "";
    frag.hash = "";
    return frag;
  }

  function syncNavActive() {
    var path = location.pathname;
    var links = document.querySelectorAll(".header-nav > a");
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute("href");
      var on = href === "/index.html" ? path === "/" || path === "/index.html" : path.indexOf(href.replace(".html", "")) === 0;
      links[i].classList.toggle("active", on);
    }
  }

  function fetchPage(url, signal) {
    var frag = fragmentURL(url);
    var key = pageKey(frag);
    if (prefetches.has(key)) return prefetches.get(key);
    if (parsedDocs.has(key)) return Promise.resolve("");

    var controller = new AbortController();
    var timedOut = false;
    if (signal) {
      signal.addEventListener("abort", function () { controller.abort(); });
    } else {
      prefetchAborters.set(key, controller);
    }
    var timer = window.setTimeout(function () {
      timedOut = true;
      prefetchAborters.delete(key);
      controller.abort();
    }, fetchTimeout);

    var request = fetch(frag, {
      credentials: "same-origin",
      signal: controller.signal,
      headers: { Accept: "text/html" },
    }).then(function (response) {
      if (!response.ok) return fetch(url, {
        credentials: "same-origin",
        signal: controller.signal,
        headers: { Accept: "text/html" },
      });
      return response;
    }).then(function (response) {
      if (!response.ok) throw new Error("navigation failed");
      var type = response.headers.get("content-type") || "";
      if (type && type.indexOf("text/html") === -1) throw new Error("navigation returned non-HTML");
      return response.text();
    }).then(function (text) {
      window.clearTimeout(timer);
      prefetchAborters.delete(key);
      prefetchReady.add(key);
      return text;
    }, function (error) {
      window.clearTimeout(timer);
      prefetchAborters.delete(key);
      if (timedOut) throw new Error("navigation timeout");
      throw error;
    });

    prefetches.set(key, request);
    request.catch(function () { prefetches.delete(key); });
    window.setTimeout(function () {
      prefetches.delete(key);
      parsedDocs.delete(key);
      prefetchReady.delete(key);
    }, 10000);
    return request;
  }

  function updatePage(doc) {
    var currentMain = document.querySelector("main");
    var nextMain = doc.querySelector("main");
    if (!currentMain || !nextMain) return false;

    var currentHeader = document.querySelector("header");
    var nextHeader = doc.querySelector("header");
    var currentFooter = document.querySelector("footer");
    var nextFooter = doc.querySelector("footer");
    if (currentHeader && nextHeader) currentHeader.replaceWith(nextHeader);
    currentMain.replaceWith(nextMain);
    if (currentFooter && nextFooter) currentFooter.replaceWith(nextFooter);

    document.title = doc.title;
    document.documentElement.lang = doc.documentElement.lang || "zh-CN";
    window.dispatchEvent(new Event("pagechange"));
    if (window.syncThemeButton) {
      window.syncThemeButton(document.documentElement.getAttribute("data-theme") || "dark");
    }
    if (window.syncRainButton) {
      window.syncRainButton();
    }
    return true;
  }

  function visit(url, replace) {
    var id = ++requestID;
    if (activeController) activeController.abort();
    activeController = new AbortController();
    var controller = activeController;
    var frag = fragmentURL(url);
    var key = pageKey(frag);
    prefetchAborters.forEach(function (c, k) {
      if (k === key) return;
      c.abort();
      prefetchAborters.delete(k);
    });
    var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var main = document.querySelector("main");
    if (main) main.setAttribute("aria-busy", "true");
    rememberScroll();
    /* Scroll memory is keyed by the page URL itself, not the
       .frag.html fetch key — the two namespaces must not mix. */
    var urlKey = pageKey(url);
    var exitStart = null;
    if (!reduced && main) {
      exitStart = performance.now();
      main.classList.add("page-leaving");
    }

    fetchPage(url, controller.signal).then(function (html) {
      if (id !== requestID) return;
      var wait = reduced || exitStart === null ? 0 : Math.max(0, exitDuration - (performance.now() - exitStart));
      return new Promise(function (resolve) {
        setTimeout(resolve, wait);
      }).then(function () {
        prefetches.delete(key);
        prefetchReady.delete(key);
        /* Move the viewport while the old sheet is faded out and the
           new one is not stamped in yet, so the jump is never seen:
           a back/forward returns to where the reader left that page,
           a fresh visit starts at the head. */
        if (!url.hash) {
          if (replace) restoreScroll(urlKey);
          else window.scrollTo(0, 0);
        }
        var doc = parsedDocs.get(key);
        if (!doc) {
          doc = new DOMParser().parseFromString(html, "text/html");
          parsedDocs.set(key, doc);
        }
        if (!updatePage(doc)) throw new Error("invalid page");
        if (replace) history.replaceState(null, "", url.href);
        else history.pushState(null, "", url.href);
        lastHref = url.href;
        syncNavActive();
        if (url.hash) {
          var target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
          if (target) target.scrollIntoView({ behavior: "auto", block: "start" });
        }
      });
    }).catch(function (error) {
      if (id !== requestID || error.name === "AbortError") return;
      location.href = url.href;
    }).then(function () {
      if (id !== requestID) return;
      if (activeController === controller) activeController = null;
      var current = document.querySelector("main");
      if (current) current.removeAttribute("aria-busy");
    });
  }

  document.addEventListener("pointerover", function (event) {
    var link = event.target.closest && event.target.closest("a");
    if (!isNavigable(link)) return;
    fetchPage(new URL(link.href, location.href)).catch(function () {});
  });

  document.addEventListener("touchstart", function (event) {
    var link = event.target.closest && event.target.closest("a");
    if (!isNavigable(link)) return;
    fetchPage(new URL(link.href, location.href)).catch(function () {});
  }, { passive: true });

  document.addEventListener("focusin", function (event) {
    var link = event.target.closest && event.target.closest("a");
    if (!isNavigable(link)) return;
    fetchPage(new URL(link.href, location.href)).catch(function () {});
  });

  document.addEventListener("click", function (event) {
    var link = event.target.closest && event.target.closest("a");
    if (!isNavigable(link, event)) return;
    event.preventDefault();
    visit(new URL(link.href, location.href), false);
  });

  window.addEventListener("popstate", function () {
    visit(new URL(location.href), true);
  });

  syncNavActive();

  /* Full page loads: with scrollRestoration off, the router owes the
     browser's old behaviour. Restore the saved position after a
     reload or a back/forward cross-document jump; ordinary link
     landings still start at the head. */
  try {
    var entries = performance.getEntriesByType && performance.getEntriesByType("navigation");
    var kind = entries && entries[0] && entries[0].type;
    if (kind === "reload" || kind === "back_forward") {
      var saved = +sessionStorage.getItem("scroll:" + pageKey(new URL(location.href))) || 0;
      if (saved) window.scrollTo(0, saved);
    }
  } catch (e) {}
})();
