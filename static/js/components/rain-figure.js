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
 *
 * Numbering is by document position. Doing that per-element means
 * every figure scans the whole document — O(N^2) for N figures. Instead
 * a single idle-time pass collects every pending figure, numbers them
 * in one sweep, and builds their frames. Route swaps replace the whole
 * <main>, so connectedCallback only marks elements pending; the sweep
 * runs once per `pagechange` and does the real work in idle slices.
 */
(function () {
  "use strict";

  var IMAGE_NO = function () {
    return "IMAGE " + String(this).padStart(2, "0");
  };

  var sweepScheduled = false;

  function buildFigure(fig, index) {
    var img = fig.querySelector(":scope > img");
    if (!img) return;

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

    fig.appendChild(head);
    fig.appendChild(body);
    fig.classList.add("is-ready");

    head.addEventListener("click", function () {
      var collapsed = fig.classList.toggle("is-collapsed");
      head.setAttribute("aria-expanded", String(!collapsed));
    });
  }

  /* One pass over the pending figures, numbering them in document
     order, then building each. Runs in idle slices so the fold frame
     never competes with the first paint of a new page. */
  function sweep() {
    sweepScheduled = false;
    var pending = document.querySelectorAll("rain-figure[data-rain-pending]");
    if (!pending.length) return;

    for (var i = 0; i < pending.length; i++) {
      var fig = pending[i];
      delete fig.dataset.rainPending;
      buildFigure(fig, i);
    }
  }

  function requestSweep() {
    if (sweepScheduled) return;
    sweepScheduled = true;
    if (typeof window.registerIdleInit === "function") {
      window.registerIdleInit(sweep);
    } else if (window.requestIdleCallback) {
      window.requestIdleCallback(sweep, { timeout: 300 });
    } else {
      window.setTimeout(sweep, 0);
    }
  }

  class RainFigure extends HTMLElement {
    connectedCallback() {
      if (this.dataset.rainBound) return;
      var img = this.querySelector(":scope > img");
      if (!img) return;
      this.dataset.rainBound = "1";
      this.dataset.rainPending = "1";
      requestSweep();
    }
  }

  customElements.define("rain-figure", RainFigure);
})();
