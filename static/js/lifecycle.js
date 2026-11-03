/* Page lifecycle + idle scheduler.
 *
 * Rainhush pages are static HTML. On a full load, or after an SPA route
 * swap (a `pagechange` event from navigation.js), the scripts below
 * register small "initializers" that hydrate the freshly stamped DOM:
 * build TOCs, number figures, arm copy buttons, render mermaid.
 *
 * Those initializers are NOT created equal:
 *   - critical work must run before the first paint of the new page;
 *   - everything else is cosmetic and can wait a frame or two.
 *
 * React/Vue hide their heavy DOM work behind a scheduler that slices
 * synchronous bursts into idle-time chunks. This is the same idea in
 * miniature: a two-tier queue.
 *   registerPageInit(fn)            -> critical, runs synchronously
 *   registerIdleInit(fn)            -> deferred, runs in idle slices
 *   registerDeferredInit(fn)        -> alias of registerIdleInit
 *
 * Timing: `pagechange` fires AFTER navigation.js has already swapped
 * the <main> subtree, so custom elements' connectedCallback (and their
 * registerIdleInit calls) land before it. To avoid scheduling the queue
 * twice per navigation, all scheduling is debounced onto a single
 * double-rAF; a generation counter invalidates stale slices when a new
 * page lands mid-flight.
 */
(function () {
  "use strict";

  var critical = [];
  var deferred = [];
  var running = false;
  var generation = 0;
  var scheduled = false;

  var hasIdle = typeof window.requestIdleCallback === "function";

  function idle(fn, timeout) {
    if (hasIdle) return window.requestIdleCallback(fn, { timeout: timeout });
    return window.setTimeout(fn, Math.max(16, timeout));
  }

  /* Slice budget: stop the current idle slice when the frame has less
     than 4ms left, unless we already blew the 250ms deadline. Every
     initializer is assumed cheap (<1ms); anything heavier is expected
     to self-throttle (see mermaid.js). */
  var SLICE_BUDGET = 4;
  var IDLE_TIMEOUT = 250;

  function runCritical() {
    for (var i = 0; i < critical.length; i++) {
      try {
        critical[i]();
      } catch (error) {
        console.error("[rainhush] page initializer failed", error);
      }
    }
  }

  function runDeferred() {
    if (!deferred.length) {
      running = false;
      return;
    }
    idle(function (deadline) {
      var gen = generation;
      while (deferred.length) {
        if (gen !== generation) return; // a new page landed; bail out
        if (
          deadline &&
          deadline.timeRemaining() <= SLICE_BUDGET &&
          !deadline.didTimeout
        ) {
          break;
        }
        var fn = deferred.shift();
        try {
          fn();
        } catch (error) {
          console.error("[rainhush] deferred initializer failed", error);
        }
      }
      if (gen === generation && deferred.length) runDeferred();
      else running = false;
    }, IDLE_TIMEOUT);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    /* Double rAF: run after the browser has painted the incoming page.
       Critical inits execute synchronously here; deferred work is
       handed to the idle scheduler in slices. */
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        scheduled = false;
        var gen = generation;
        runCritical();
        if (gen === generation && deferred.length) {
          running = true;
          runDeferred();
        }
      });
    });
  }

  window.registerPageInit = function (init) {
    if (typeof init !== "function") {
      throw new TypeError("page initializer must be a function");
    }
    critical.push(init);
    if (ready) schedule();
  };

  window.registerIdleInit = function (init) {
    if (typeof init !== "function") {
      throw new TypeError("deferred initializer must be a function");
    }
    deferred.push(init);
    if (ready) schedule();
  };
  window.registerDeferredInit = window.registerIdleInit;

  window.runPageInitializers = schedule;
  window.flushPageInitializers = function () {
    generation++;
    runCritical();
    deferred.length = 0;
    running = false;
  };

  var ready = false;
  document.addEventListener("DOMContentLoaded", function () {
    ready = true;
    schedule();
  });
  window.addEventListener("pagechange", function () {
    generation++;
    schedule();
  });
})();
