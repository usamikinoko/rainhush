/* <rain-code-copy> — copy button of a .code-block.
 *
 * The Go side (internal/markdown/codeblock.go) wraps the copy button in
 * this element. On connect the element takes over the button's behavior
 * and drops the inline onclick — unless a legacy global copyCode()
 * exists (rainhush init scaffold ships its own code.js), in which case
 * the element stays passive and the inline handler keeps working.
 * Copy behavior is the exact port of the former feature script.
 */
(function () {
  class RainCodeCopy extends HTMLElement {
    connectedCallback() {
      var btn = this.querySelector("button");
      if (!btn || btn.dataset.rainBound) return;

      if (typeof window.copyCode === "function") return;

      btn.dataset.rainBound = "1";
      btn.removeAttribute("onclick");
      btn.addEventListener("click", this.copy.bind(this, btn));
    }

    copy(btn) {
      if (btn.dataset.locked) return;
      btn.dataset.locked = "1";
      var code = btn.closest(".code-block").querySelector("code").textContent;
      var textSpan = btn.querySelector(".copy-text");
      var finish = function (ok) {
        textSpan.textContent = ok ? "Copied" : "Copy failed";
        btn.classList.toggle("copied", ok);
        setTimeout(function () {
          textSpan.textContent = "Copy";
          btn.classList.remove("copied");
          delete btn.dataset.locked;
        }, ok ? 2000 : 1500);
      };
      var fallback = function () {
        var area = document.createElement("textarea");
        area.value = code;
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        var ok = document.execCommand("copy");
        area.remove();
        finish(ok);
      };

      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(code).then(function () { finish(true); }, fallback);
        return;
      }
      fallback();
    }
  }

  customElements.define("rain-code-copy", RainCodeCopy);
})();
