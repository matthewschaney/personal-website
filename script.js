(function () {
  const root = document.documentElement;

  // Theme init
  const stored = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = stored || (prefersDark ? 'dark' : 'light');
  if (theme === 'dark') root.setAttribute('data-theme', 'dark');

  // Theme toggle
  const toggle = document.getElementById('themeToggle');
  toggle?.addEventListener('click', () => {
    const isDark = root.getAttribute('data-theme') === 'dark';
    root.setAttribute('data-theme', isDark ? 'light' : 'dark');
    localStorage.setItem('theme', isDark ? 'light' : 'dark');
  });

  // Year stamp
  document.getElementById('year').textContent = new Date().getFullYear();

  // Projects loader
  fetch('projects.json')
    .then(r => r.json())
    .then(projects => {
      const grid = document.getElementById('projectsGrid');
      grid.innerHTML = '';
      projects.forEach(p => {
        const card = document.createElement('article');
        card.className = 'card reveal';
        card.innerHTML = `
          <h3><a href="${p.url}" target="_blank" rel="noopener">${p.name}</a></h3>
          <p>${p.description}</p>
          ${p.image ? `<img src="${p.image}" alt="${p.name} screenshot" loading="lazy">` : ''}
          <div class="tags">
            ${(p.tags || []).map(t => `<span class="tag">${t}</span>`).join('')}
          </div>
        `;
        grid.appendChild(card);
      });
    })
    .catch(() => {
      document.getElementById('projectsGrid').innerHTML = `
        <p class="muted">Add your projects to projects.json to see them here.</p>
      `;
    });

  // Active section -> nav [aria-current]
  const sections = [...document.querySelectorAll('.hero, main .section')];
  const navlinks = [...document.querySelectorAll('.nav a[href^="#"]')];
  const setActive = (id) => {
    navlinks.forEach(a => a.setAttribute('aria-current', a.getAttribute('href') === id ? 'true' : 'false'));
  };
  const io = new IntersectionObserver(entries => {
    const visible = entries
      .filter(e => e.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    const id = '#' + visible.target.id;
    setActive(id);
  }, { rootMargin: '-40% 0px -55% 0px', threshold: [0, .25, .5, .75, 1] });
  sections.forEach(s => io.observe(s));

  // Smooth hash transitions using View Transitions (progressive)
  if (document.startViewTransition) {
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener('click', e => {
        const href = a.getAttribute('href');
        const target = document.querySelector(href);
        if (!target) return;
        e.preventDefault();
        document.startViewTransition(() => {
          target.scrollIntoView({ behavior: 'instant', block: 'start' });
          history.pushState(null, '', href);
          setActive(href);
        });
      });
    });
  } else {
    // fallback smooth scroll
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener('click', e => {
        const href = a.getAttribute('href');
        const target = document.querySelector(href);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        history.pushState(null, '', href);
      });
    });
  }

  // Starfield background (respects reduced motion)
  (() => {
    const canvas = document.getElementById('stars');
    if (!canvas) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ctx = canvas.getContext('2d', { alpha: true });
    let w = 0, h = 0, dpr = 1, stars = [], anim, paused = prefersReduced;

    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const seed = () => {
      const count = Math.floor((w * h) / 9000);
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        z: Math.random() * 0.7 + 0.3,
        vx: (Math.random() - 0.5) * 0.05,
        vy: (Math.random() - 0.5) * 0.05
      }));
    };

    const step = () => {
      if (paused) return;
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        const size = s.z * 1.6;
        ctx.globalAlpha = 0.6 + s.z * 0.4;
        ctx.fillRect(s.x, s.y, size, size);
        s.x += s.vx * (1.5 - s.z);
        s.y += s.vy * (1.5 - s.z);
        if (s.x < -2 || s.x > w + 2 || s.y < -2 || s.y > h + 2) {
          s.x = (s.x + w) % w;
          s.y = (s.y + h) % h;
        }
      }
      anim = requestAnimationFrame(step);
    };

    const visibility = () => {
      const hidden = document.hidden || prefersReduced;
      paused = hidden;
      if (hidden && anim) cancelAnimationFrame(anim);
      else anim = requestAnimationFrame(step);
    };

    new ResizeObserver(() => { resize(); seed(); }).observe(canvas);
    resize(); seed();
    document.addEventListener('visibilitychange', visibility, { passive: true });
    visibility();
  })();

})();
