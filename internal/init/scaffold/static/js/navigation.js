(function () {
  var requestID = 0;
  var activeController = null;
  var prefetches = new Map();

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

  function fetchPage(url, signal) {
    var key = pageKey(url);
    if (prefetches.has(key)) return prefetches.get(key);
    var request = fetch(key, {
      credentials: "same-origin",
      signal: signal,
      headers: { Accept: "text/html" },
    }).then(function (response) {
      if (!response.ok) throw new Error("navigation failed");
      var type = response.headers.get("content-type") || "";
      if (type && type.indexOf("text/html") === -1) throw new Error("navigation returned non-HTML");
      return response.text();
    });
    prefetches.set(key, request);
    request.catch(function () { prefetches.delete(key); });
    window.setTimeout(function () { prefetches.delete(key); }, 10000);
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
    return true;
  }

  function visit(url, replace) {
    var id = ++requestID;
    if (activeController) activeController.abort();
    activeController = new AbortController();
    var controller = activeController;
    var main = document.querySelector("main");
    if (main) main.setAttribute("aria-busy", "true");

    fetchPage(url, controller.signal).then(function (html) {
      if (id !== requestID) return;
      prefetches.delete(pageKey(url));
      var doc = new DOMParser().parseFromString(html, "text/html");
      if (!updatePage(doc)) throw new Error("invalid page");
      if (replace) history.replaceState(null, "", url.href);
      else history.pushState(null, "", url.href);
      if (url.hash) {
        var target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
        if (target) target.scrollIntoView({ behavior: "auto", block: "start" });
      } else {
        window.scrollTo(0, 0);
      }
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
})();
