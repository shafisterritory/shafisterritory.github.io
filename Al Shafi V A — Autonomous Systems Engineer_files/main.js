/* ═══════════════════════════════════════════════════════════
   Interaction layer: reveals, nav, filters, tabs, counters.
   Everything here is progressive — the page reads fine without it.
   ═══════════════════════════════════════════════════════════ */

(() => {
  'use strict';

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;


  /* ── theme ─────────────────────────────────────────────── */
  const root = document.documentElement;
  const stored = localStorage.getItem('theme');
  const prefersDark = matchMedia('(prefers-color-scheme: dark)').matches;
  setTheme(stored || (prefersDark ? 'dark' : 'light'));

  function setTheme(t) {
    root.dataset.theme = t;
    document.dispatchEvent(new CustomEvent('themechange', { detail: t }));
  }

  $('#themeToggle')?.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('theme', next);
  });

  // Follow the OS unless the visitor has made an explicit choice.
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (!localStorage.getItem('theme')) setTheme(e.matches ? 'dark' : 'light');
  });


  /* ── scroll reveal ─────────────────────────────────────── */
  const revealables = $$('[data-reveal]');
  if (reduce || !('IntersectionObserver' in window)) {
    revealables.forEach(el => el.classList.add('is-in'));
  } else {
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        obs.unobserve(e.target);               // reveal once, then forget
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.05 });

    revealables.forEach(el => io.observe(el));
  }

  /* timeline entries light their own dot */
  if (!reduce && 'IntersectionObserver' in window) {
    const tlio = new IntersectionObserver((entries) => {
      entries.forEach(e => e.isIntersecting && e.target.classList.add('is-in'));
    }, { rootMargin: '0px 0px -30% 0px' });
    $$('.tl').forEach(el => tlio.observe(el));

    const langs = $('.langs');
    if (langs) new IntersectionObserver(([e], o) => {
      if (e.isIntersecting) { langs.classList.add('is-in'); o.disconnect(); }
    }, { threshold: 0.4 }).observe(langs);
  } else {
    $$('.tl').forEach(el => el.classList.add('is-in'));
    $('.langs')?.classList.add('is-in');
  }


  /* ── nav: stuck state, progress bar, current section ───── */
  const nav      = $('#nav');
  const progress = $('#navProgress');
  const links    = $$('.nav__links a');
  const sections = links.map(a => $(a.getAttribute('href'))).filter(Boolean);
  const rail     = $('#timelineFill');
  const timeline = $('#timeline');

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y   = scrollY;
      const max = document.body.scrollHeight - innerHeight;

      nav?.classList.toggle('is-stuck', y > 12);
      progress?.style.setProperty('--p', max > 0 ? (y / max).toFixed(4) : 0);

      /* which section are we in */
      const probe = y + innerHeight * 0.32;
      let current = null;
      for (const s of sections) if (s.offsetTop <= probe) current = s;
      links.forEach(a => a.classList.toggle('is-current',
        current && a.getAttribute('href') === '#' + current.id));

      /* timeline rail draws itself as you pass */
      if (rail && timeline) {
        const r = timeline.getBoundingClientRect();
        const t = (innerHeight * 0.6 - r.top) / r.height;
        rail.style.setProperty('--fill', Math.max(0, Math.min(1, t)).toFixed(4));
      }

      ticking = false;
    });
  }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll, { passive: true });
  onScroll();


  /* ── project filters ───────────────────────────────────── */
  const cards = $$('#projectGrid .card');
  const empty = $('#gridEmpty');

  $$('.filter').forEach(btn => {
    btn.addEventListener('click', () => {
      const want = btn.dataset.filter;

      $$('.filter').forEach(b => {
        const on = b === btn;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-selected', String(on));
      });

      let shown = 0;
      cards.forEach(card => {
        const match = want === 'all' || card.dataset.tags.split(' ').includes(want);
        if (match) shown++;
        card.classList.toggle('is-hidden', !match);
      });

      if (empty) empty.hidden = shown > 0;
    });
  });


  /* ── research tabs ─────────────────────────────────────── */
  const tabs   = $$('.tab');
  const panels = $$('.tab-panel');

  function selectTab(tab) {
    tabs.forEach(t => {
      const on = t === tab;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', String(on));
    });
    panels.forEach(p => p.classList.toggle('is-active', p.dataset.panel === tab.dataset.tab));
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', e => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      const next = tabs[(i + d + tabs.length) % tabs.length];
      next.focus(); selectTab(next);
    });
  });


  /* ── stat counters ─────────────────────────────────────── */
  $$('[data-count]').forEach(el => {
    const target = +el.dataset.count;
    if (reduce) { el.textContent = target; return; }

    let started = false;
    const run = () => {
      if (started) return;
      started = true;
      const t0 = performance.now(), dur = 1100;
      const tickFn = now => {
        const p = Math.min((now - t0) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 4);       // quart-out, matches the CSS
        el.textContent = Math.round(target * eased);
        if (p < 1) requestAnimationFrame(tickFn);
      };
      requestAnimationFrame(tickFn);
    };

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e], o) => {
        if (e.isIntersecting) { run(); o.disconnect(); }
      }, { threshold: 0.6 }).observe(el);
    } else run();
  });


  /* ── missing images degrade to labelled placeholders ───── */
  /* onerror is inline so it fires even if this script is slow;
     this catches images already cached as broken. */
  $$('.card__media img, .portrait img').forEach(img => {
    if (img.complete && img.naturalWidth === 0) {
      (img.closest('.card__media') || img.closest('.portrait'))?.classList.add('is-empty');
    }
  });


  /* ── odds and ends ─────────────────────────────────────── */
  const year = $('#year');
  if (year) year.textContent = new Date().getFullYear();

})();
