/* <rain-figure> — the folding figure plate.
 *
 * The Go side (internal/markdown/figure.go) wraps lone-image markdown
 * paragraphs in this element. On connect the element grows:
 *   [ IMAGE 01 · alt caption · drawn +/− ]  ← .rain-figure-head (button)
 *   [ image ]                              ← .rain-figure-body > .rain-figure-clip
 * Folding animates grid-template-rows 1fr ↔ 0fr, so the prose below
 * slides with the motion. The <img> element itself is never rebuilt,
 * reloaded or swapped — it only reflows — which is what keeps the
 * fold free of refetches and re-decode flicker.
 * Without JS the element stays a bare image: no head is built, no
 * frame is drawn (the frame is gated on .is-ready).
 */
(function () {
  "use strict";

  var IMAGE_NO = function () {
    return "IMAGE " + String(this).padStart(2, "0");
  };

  class RainFigure extends HTMLElement {
    connectedCallback() {
      if (this.dataset.rainBound) return;
      var img = this.querySelector(":scope > img");
      if (!img) return;
      this.dataset.rainBound = "1";

      // Number by document position, not by a module counter — the
      // bundle survives SPA route swaps, a counter would keep growing.
      var all = document.getElementsByTagName("rain-figure");
      var index = 0;
      for (var i = 0; i < all.length; i++) {
        if (all[i] === this) break;
        index++;
      }

      var id = "rain-fig-" + (index + 1);

      var head = document.createElement("button");
      head.type = "button";
      head.className = "rain-figure-head";
      head.setAttribute("aria-expanded", "true");
      head.setAttribute("aria-controls", id);

      var tag = document.createElement("span");
      tag.className = "rain-figure-tag";
      tag.textContent = IMAGE_NO.call(index + 1);

      var caption = document.createElement("span");
      caption.className = "rain-figure-caption";
      var alt = (img.getAttribute("alt") || "").trim();
      if (alt) {
        caption.textContent = alt;
      } else {
        caption.classList.add("is-empty");
      }

      var mark = document.createElement("span");
      mark.className = "rain-figure-mark";
      mark.setAttribute("aria-hidden", "true");

      head.appendChild(tag);
      head.appendChild(caption);
      head.appendChild(mark);

      var body = document.createElement("div");
      body.className = "rain-figure-body";
      body.id = id;
      var clip = document.createElement("div");
      clip.className = "rain-figure-clip";
      clip.appendChild(img); // moves the existing node — no reparse, no refetch
      body.appendChild(clip);

      this.appendChild(head);
      this.appendChild(body);
      this.classList.add("is-ready");

      var self = this;
      head.addEventListener("click", function () {
        var collapsed = self.classList.toggle("is-collapsed");
        head.setAttribute("aria-expanded", String(!collapsed));
      });
    }
  }

  customElements.define("rain-figure", RainFigure);
})();
