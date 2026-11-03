(function () {
  var initialized = false;
  var loading = false;
  var observer = null;

  function schedule(fn) {
    if (window.requestIdleCallback) window.requestIdleCallback(fn, { timeout: 300 });
    else setTimeout(fn, 200);
  }

  function renderNode(node) {
    mermaid.run({ nodes: [node] }).catch(function () {});
  }

  function run() {
    var nodes = document.querySelectorAll("pre.mermaid");
    if (!nodes.length) return;
    if (typeof mermaid === "undefined") {
      if (loading) return;
      loading = true;
      var script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js";
      script.async = true;
      script.onload = function () { loading = false; run(); };
      script.onerror = function () { loading = false; script.remove(); };
      document.head.appendChild(script);
      return;
    }
    if (!initialized) {
      mermaid.initialize({
        startOnLoad: false,
        theme: "default",
        securityLevel: "antiscript",
      });
      initialized = true;
    }
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (!window.IntersectionObserver) {
      schedule(function () {
        for (var i = 0; i < nodes.length; i++) renderNode(nodes[i]);
      });
      return;
    }
    observer = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (!entries[i].isIntersecting) continue;
        var node = entries[i].target;
        observer.unobserve(node);
        renderNode(node);
      }
    }, { rootMargin: "300px 0px" });
    for (var j = 0; j < nodes.length; j++) observer.observe(nodes[j]);
  }

  window.initMermaidDiagrams = run;
  /* Mermaid parsing + SVG render is heavy and already lazy (gated on
     IntersectionObserver). Defer the initial scan off the critical
     path so it never blocks the article's first paint. */
  if (window.registerIdleInit) window.registerIdleInit(run);
  else if (window.registerPageInit) window.registerPageInit(run);
  else document.addEventListener("DOMContentLoaded", run);
})();
