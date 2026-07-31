(function () {
  "use strict";

  var THEMES = ["dossier", "editorial", "ops"];
  var root = document.documentElement;
  var buttons = document.querySelectorAll("[data-set-theme]");

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
  }

  buttons.forEach(function (b) {
    b.addEventListener("click", function () {
      apply(b.dataset.setTheme);
    });
    b.setAttribute("aria-pressed", String(b.dataset.setTheme === current()));
  });

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
