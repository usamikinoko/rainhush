(function () {
  var requestID = 0;
  var activeController = null;
  var prefetches = new Map();
  var parsedDocs = new Map();
  var prefetchReady = new Set();
  var prefetchAborters = new Map();
  var fetchTimeout = 8000;
  var exitDuration = 180;

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
    var active = "Home";
    if (path.indexOf("/articles") === 0) active = "Articles";
    else if (path.indexOf("/friends") === 0) active = "Friends";
    else if (path.indexOf("/about") === 0) active = "About";
    var links = document.querySelectorAll(".header-nav > a");
    for (var i = 0; i < links.length; i++) {
      links[i].classList.toggle("active", links[i].textContent.trim() === active);
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
    if (!url.hash) window.scrollTo(0, 0);
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
        var doc = parsedDocs.get(key);
        if (!doc) {
          doc = new DOMParser().parseFromString(html, "text/html");
          parsedDocs.set(key, doc);
        }
        if (!updatePage(doc)) throw new Error("invalid page");
        if (replace) history.replaceState(null, "", url.href);
        else history.pushState(null, "", url.href);
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
})();
