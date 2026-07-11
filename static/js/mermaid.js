(function () {
  var initialized = false;

  function run() {
    if (typeof mermaid === "undefined") return;
    if (!initialized) {
      mermaid.initialize({
        startOnLoad: false,
        theme: "default",
        securityLevel: "antiscript",
      });
      initialized = true;
    }

    if (document.querySelector("pre.mermaid")) {
      mermaid.run({ querySelector: "pre.mermaid" });
    }
  }

  window.initMermaidDiagrams = run;
  document.addEventListener("DOMContentLoaded", run);
})();
