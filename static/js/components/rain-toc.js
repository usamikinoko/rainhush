/* <rain-toc> — article table of contents.
 *
 * The server renders an empty <rain-toc class="post-toc"> placeholder;
 * this element fills itself from the .post-body headings on connect.
 * Behavior is the exact port of the former feature script (toc.js):
 * same DOM (nav.toc-nav > ol.toc-list > li.toc-item--hN > a.toc-link),
 * same toc-N heading ids, same IntersectionObserver margins.
 */
(function () {
  class RainToc extends HTMLElement {
    connectedCallback() {
      this.build();
    }

    disconnectedCallback() {
      if (this._observer) {
        this._observer.disconnect();
        this._observer = null;
      }
    }

    build() {
      var body = document.querySelector(".post-body");
      if (!body) return;
      if (this._observer) {
        this._observer.disconnect();
        this._observer = null;
      }

      var headings = body.querySelectorAll("h2,h3");
      if (headings.length < 2) {
        this.innerHTML = "";
        this.style.display = "none";
        return;
      }

      this.innerHTML = "";
      var nav = document.createElement("nav");
      nav.className = "toc-nav";
      var list = document.createElement("ol");
      list.className = "toc-list";
      for (var i = 0; i < headings.length; i++) {
        var heading = headings[i];
        var id = "toc-" + i;
        heading.id = id;
        var item = document.createElement("li");
        item.className = "toc-item toc-item--" + heading.tagName.toLowerCase();
        var link = document.createElement("a");
        link.className = "toc-link";
        link.href = "#" + id;
        link.textContent = heading.textContent.trim();
        link.addEventListener("click", function (event) {
          event.preventDefault();
          var target = document.getElementById(this.getAttribute("href").slice(1));
          if (target) target.scrollIntoView({
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
            block: "start",
          });
        });
        item.appendChild(link);
        list.appendChild(item);
      }
      nav.appendChild(list);
      this.appendChild(nav);

      var links = this.querySelectorAll(".toc-link");
      this._observer = new IntersectionObserver(
        function (entries) {
          for (var j = 0; j < entries.length; j++) {
            var entry = entries[j];
            var idx = parseInt(entry.target.id.replace("toc-", ""), 10);
            if (entry.isIntersecting) {
              for (var k = 0; k < links.length; k++)
                links[k].classList.remove("toc-link--active");
              if (links[idx]) links[idx].classList.add("toc-link--active");
            }
          }
        },
        { rootMargin: "-80px 0px -70% 0px" },
      );
      for (var m = 0; m < headings.length; m++) this._observer.observe(headings[m]);
      this.style.display = "block";
    }
  }

  customElements.define("rain-toc", RainToc);
})();
