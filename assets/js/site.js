(function () {
  "use strict";

  var THEMES = ["dossier", "editorial", "ops"];
  var root = document.documentElement;
  var buttons = document.querySelectorAll(".theme-switch button[data-set-theme]");

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

  /* Scroll reveal — skipped entirely under reduced motion */
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var items = document.querySelectorAll(".reveal");
  if (reduce || !("IntersectionObserver" in window)) {
    items.forEach(function (el) { el.classList.add("in"); });
    return;
  }
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
})();
