(function () {
  "use strict";

  var THEMES = ["dossier", "editorial", "ops"];
  var root = document.documentElement;
  var buttons = document.querySelectorAll("[data-set-theme]");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function current() {
    var t = root.getAttribute("data-theme");
    return THEMES.indexOf(t) >= 0 ? t : "dossier";
  }

  function apply(theme) {
    if (theme === "dossier") {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", theme);
    }
    buttons.forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.setTheme === theme));
    });
    try {
      localStorage.setItem("ca-theme", theme);
    } catch (e) {
      /* private mode — theme just won't persist */
    }
    layoutStack();
    recede();
  }

  buttons.forEach(function (b) {
    b.addEventListener("click", function () {
      apply(b.dataset.setTheme);
    });
    b.setAttribute("aria-pressed", String(b.dataset.setTheme === current()));
  });

  /* Floating switcher appears once the masthead (and its switcher) scrolls away */
  var float_ = document.querySelector(".theme-float");
  var mast = document.querySelector(".masthead");
  if (float_ && mast && "IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      float_.classList.toggle("show", !entries[0].isIntersecting);
    }).observe(mast);
  } else if (float_) {
    float_.classList.add("show");
  }

  /* Scroll reveal — skipped entirely under reduced motion */
  var items = document.querySelectorAll(".reveal");
  if (reduce || !("IntersectionObserver" in window)) {
    items.forEach(function (el) { el.classList.add("in"); });
  } else {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
    );
    items.forEach(function (el) { io.observe(el); });
  }

  /* ---- Case stack: scroll-through deck --------------------------------
     Each card pins below the top as you scroll; the next slides over it,
     and covered cards recede (scale + dim). Cards taller than the viewport
     pin bottom-aligned so no content is ever unreachable. Desktop only;
     Editorial stays flat (CSS also enforces this). */
  var casesWrap = document.querySelector(".cases");
  var slots = casesWrap
    ? Array.prototype.slice.call(casesWrap.querySelectorAll(".case-slot"))
    : [];
  var stackOn = false;
  var PEEK = 16;

  function layoutStack() {
    if (!casesWrap || slots.length < 2) return;
    stackOn = window.matchMedia("(min-width: 900px)").matches;
    casesWrap.classList.toggle("stack", stackOn);
    if (!stackOn) {
      slots.forEach(function (s) {
        s.style.removeProperty("--pin");
        s.style.transform = "";
        s.style.filter = "";
      });
      return;
    }
    var vh = window.innerHeight;
    slots.forEach(function (s, i) {
      var base = root.getAttribute("data-theme") === "ops" ? 58 : 22;
      var ideal = base + i * PEEK;
      var fit = vh - s.offsetHeight - 24;
      s.style.setProperty("--pin", Math.min(ideal, fit) + "px");
    });
  }

  function recede() {
    if (!stackOn || slots.length < 2) return;
    var editorial = root.getAttribute("data-theme") === "editorial";
    for (var i = 0; i < slots.length - 1; i++) {
      if (editorial || reduce) {
        slots[i].style.transform = "";
        slots[i].style.filter = "";
        continue;
      }
      var cur = slots[i].getBoundingClientRect();
      var nxt = slots[i + 1].getBoundingClientRect();
      var p = 1 - (nxt.top - cur.top - PEEK) / Math.max(cur.height, 1);
      p = Math.max(0, Math.min(1, p));
      if (p > 0.001) {
        slots[i].style.transform = "scale(" + (1 - 0.05 * p).toFixed(4) + ")";
        slots[i].style.filter = "brightness(" + (1 - 0.14 * p).toFixed(3) + ")";
      } else {
        slots[i].style.transform = "";
        slots[i].style.filter = "";
      }
    }
  }

  var scrollRaf = null;
  window.addEventListener(
    "scroll",
    function () {
      if (scrollRaf) return;
      scrollRaf = requestAnimationFrame(function () {
        scrollRaf = null;
        recede();
      });
    },
    { passive: true }
  );
  window.addEventListener("resize", function () {
    layoutStack();
    recede();
  });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      layoutStack();
      recede();
    });
  }
  window.addEventListener("load", function () {
    layoutStack();
    recede();
  });
  layoutStack();
  recede();

  /* Case-card tilt: ≤2°, pointer devices only, never in the flat Editorial theme */
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (!reduce && fine) {
    document.querySelectorAll(".case").forEach(function (card) {
      var raf = null;
      card.addEventListener("mousemove", function (e) {
        if (root.getAttribute("data-theme") === "editorial") return;
        if (raf) return;
        raf = requestAnimationFrame(function () {
          raf = null;
          var r = card.getBoundingClientRect();
          var px = (e.clientX - r.left) / r.width - 0.5;
          var py = (e.clientY - r.top) / r.height - 0.5;
          card.style.transform =
            "perspective(1100px) rotateX(" + (-py * 4).toFixed(2) + "deg) rotateY(" +
            (px * 4).toFixed(2) + "deg) translateY(-2px)";
        });
      });
      card.addEventListener("mouseleave", function () {
        if (raf) { cancelAnimationFrame(raf); raf = null; }
        card.style.transform = "";
      });
    });
  }
})();
