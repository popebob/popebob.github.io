/* eslint-env browser */
(function () {
  'use strict'

  const THEMES = ['dossier', 'editorial', 'ops']
  const root = document.documentElement
  const buttons = document.querySelectorAll('[data-set-theme]')
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  function current () {
    const t = root.getAttribute('data-theme')
    return THEMES.indexOf(t) >= 0 ? t : 'dossier'
  }

  function apply (theme) {
    if (theme === 'dossier') {
      root.removeAttribute('data-theme')
    } else {
      root.setAttribute('data-theme', theme)
    }
    buttons.forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.setTheme === theme))
    })
    try {
      localStorage.setItem('ca-theme', theme)
    } catch (e) {
      /* private mode — theme just won't persist */
    }
    layoutStack()
    recede()
    streamLog()
  }

  buttons.forEach(function (b) {
    b.addEventListener('click', function () {
      apply(b.dataset.setTheme)
    })
    b.setAttribute('aria-pressed', String(b.dataset.setTheme === current()))
  })

  /* Floating switcher appears once the masthead (and its switcher) scrolls away */
  const float_ = document.querySelector('.theme-float')
  const mast = document.querySelector('.masthead')
  if (float_ && mast && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      float_.classList.toggle('show', !entries[0].isIntersecting)
    }).observe(mast)
  } else if (float_) {
    float_.classList.add('show')
  }

  /* Scroll reveal — skipped entirely under reduced motion */
  const items = document.querySelectorAll('.reveal')
  if (reduce || !('IntersectionObserver' in window)) {
    items.forEach(function (el) { el.classList.add('in') })
  } else {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('in')
            io.unobserve(entry.target)
          }
        })
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 }
    )
    items.forEach(function (el) { io.observe(el) })
  }

  /* ---- Case stack: scroll-through deck --------------------------------
     Each card pins below the top as you scroll; the next slides over it,
     and covered cards recede (scale + dim). Cards taller than the viewport
     pin bottom-aligned so no content is ever unreachable. Desktop only;
     Editorial stays flat (CSS also enforces this). */
  const casesWrap = document.querySelector('.cases')
  const slots = casesWrap
    ? Array.prototype.slice.call(casesWrap.querySelectorAll('.case-slot'))
    : []
  let stackOn = false
  const PEEK = 16

  function flatTheme () {
    const t = root.getAttribute('data-theme')
    return t === 'editorial' || t === 'ops'
  }

  function layoutStack () {
    if (!casesWrap || slots.length < 2) return
    stackOn = !flatTheme() && window.matchMedia('(min-width: 900px)').matches
    casesWrap.classList.toggle('stack', stackOn)
    if (!stackOn) {
      slots.forEach(function (s) {
        s.style.removeProperty('--pin')
        s.style.transform = ''
        s.style.filter = ''
      })
      return
    }
    const vh = window.innerHeight
    slots.forEach(function (s, i) {
      const ideal = 22 + i * PEEK
      const fit = vh - s.offsetHeight - 24
      s.style.setProperty('--pin', Math.min(ideal, fit) + 'px')
    })
  }

  function recede () {
    if (!stackOn || slots.length < 2) return
    const flat = flatTheme()
    for (let i = 0; i < slots.length - 1; i++) {
      if (flat || reduce) {
        slots[i].style.transform = ''
        slots[i].style.filter = ''
        continue
      }
      const cur = slots[i].getBoundingClientRect()
      const nxt = slots[i + 1].getBoundingClientRect()
      let p = 1 - (nxt.top - cur.top - PEEK) / Math.max(cur.height, 1)
      p = Math.max(0, Math.min(1, p))
      if (p > 0.001) {
        slots[i].style.transform = 'scale(' + (1 - 0.05 * p).toFixed(4) + ')'
        slots[i].style.filter = 'brightness(' + (1 - 0.14 * p).toFixed(3) + ')'
      } else {
        slots[i].style.transform = ''
        slots[i].style.filter = ''
      }
    }
  }

  /* ---- Ops log streaming: blocks "print" as they cross the reveal line;
     the caret rides the last printed block. Monotonic, like real output. */
  const units = Array.prototype.slice.call(
    document.querySelectorAll(
      '.cases .case-head, .cases .case-metric, .cases .sar, .cases .case-callout, .cases .tags'
    )
  )
  let frontierEl = null

  function streamLog () {
    if (!units.length) return
    if (root.getAttribute('data-theme') !== 'ops' || reduce) return
    /* Reveal line sits at 62% of the viewport so the lower third reads as
       unwritten screen. Each block prints line-by-line (stepped clip in
       line-height slices, ~75ms/line, tail -f style); bursts queue. */
    const LINE_MS = 75
    const line = window.innerHeight * 0.62
    let delay = 0
    units.forEach(function (u) {
      if (!u.classList.contains('logged') && u.getBoundingClientRect().top < line) {
        const lh = parseFloat(getComputedStyle(u).lineHeight) || 24
        const lines = Math.max(1, Math.round(u.offsetHeight / lh))
        u.classList.add('logged', 'printing')
        u.style.animationDuration = Math.min(lines * LINE_MS, 900) + 'ms'
        u.style.animationTimingFunction = 'steps(' + lines + ', end)'
        u.style.animationDelay = delay + 'ms'
        delay = Math.min(delay + lines * LINE_MS, 1100)
      }
    })
    let frontier = null
    for (let i = units.length - 1; i >= 0; i--) {
      if (units[i].classList.contains('logged')) {
        frontier = units[i]
        break
      }
    }
    if (frontierEl && frontierEl !== frontier) frontierEl.classList.remove('frontier')
    if (frontier) frontier.classList.add('frontier')
    frontierEl = frontier
  }

  let scrollRaf = null
  window.addEventListener(
    'scroll',
    function () {
      if (scrollRaf) return
      scrollRaf = requestAnimationFrame(function () {
        scrollRaf = null
        recede()
        streamLog()
      })
    },
    { passive: true }
  )
  window.addEventListener('resize', function () {
    layoutStack()
    recede()
    streamLog()
  })
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      layoutStack()
      recede()
      streamLog()
    })
  }
  window.addEventListener('load', function () {
    layoutStack()
    recede()
    streamLog()
  })
  layoutStack()
  recede()
  streamLog()

  /* Case-card tilt: ≤2°, pointer devices only, never in the flat Editorial theme */
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches
  if (!reduce && fine) {
    document.querySelectorAll('.case').forEach(function (card) {
      let raf = null
      card.addEventListener('mousemove', function (e) {
        if (flatTheme()) return
        if (raf) return
        raf = requestAnimationFrame(function () {
          raf = null
          const r = card.getBoundingClientRect()
          const px = (e.clientX - r.left) / r.width - 0.5
          const py = (e.clientY - r.top) / r.height - 0.5
          card.style.transform =
            'perspective(1100px) rotateX(' + (-py * 4).toFixed(2) + 'deg) rotateY(' +
            (px * 4).toFixed(2) + 'deg) translateY(-2px)'
        })
      })
      card.addEventListener('mouseleave', function () {
        if (raf) { cancelAnimationFrame(raf); raf = null }
        card.style.transform = ''
      })
    })
  }
})()
