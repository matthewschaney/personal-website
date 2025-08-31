(function () {
  const root = document.documentElement;

  // Theme toggle
  const stored = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = stored || (prefersDark ? 'dark' : 'light');
  if (theme === 'dark') root.setAttribute('data-theme', 'dark');
  document.getElementById('themeToggle')?.addEventListener('click', () => {
    const isDark = root.getAttribute('data-theme') === 'dark';
    root.setAttribute('data-theme', isDark ? 'light' : 'dark');
    localStorage.setItem('theme', isDark ? 'light' : 'dark');
  });

  // Year
  document.getElementById('year').textContent = new Date().getFullYear();

  // Active section nav
  const sections = [...document.querySelectorAll('.hero, main .section')];
  const navlinks = [...document.querySelectorAll('.nav a[href^="#"]')];
  const setActive = (id) =>
    navlinks.forEach((a) =>
      a.setAttribute('aria-current', a.getAttribute('href') === id ? 'true' : 'false')
    );
  const io = new IntersectionObserver(
    (es) => {
      const v = es
        .filter((e) => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!v) return;
      setActive('#' + v.target.id);
    },
    { rootMargin: '-40% 0px -55% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] }
  );
  sections.forEach((s) => io.observe(s));

  // Smooth hash navigation
  if (document.startViewTransition) {
    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const href = a.getAttribute('href');
        const t = document.querySelector(href);
        if (!t) return;
        e.preventDefault();
        document.startViewTransition(() => {
          t.scrollIntoView({ behavior: 'instant' });
          history.pushState(null, '', href);
          setActive(href);
        });
      });
    });
  } else {
    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener('click', (e) => {
        const href = a.getAttribute('href');
        const t = document.querySelector(href);
        if (!t) return;
        e.preventDefault();
        t.scrollIntoView({ behavior: 'smooth' });
        history.pushState(null, '', href);
      });
    });
  }

  // ===== Starfield: circular ring around hero content =====
  (() => {
    const canvas = document.getElementById('stars');
    const contentEl = document.querySelector('.hero .container');
    if (!canvas || !contentEl) return;

    const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ctx = canvas.getContext('2d', { alpha: true });

    // Tunables
    const STAR_COUNT = 260;
    const RING_MARGIN = 90;
    const RING_THICKNESS = 70;
    const TANGENTIAL_SPEED = 85;
    const RADIAL_SPRING = 2.0;
    const DRAG = 0.03;
    const TWINKLE = 0.22;
    const DPR_MAX = 2;

    let w = 0,
      h = 0,
      dpr = 1;
    let cx = 0,
      cy = 0;
    let ringR = 200;
    let stars = [];
    let anim,
      lastT = 0,
      paused = prefersReduced;

    const calcGeometry = () => {
      const cRect = canvas.getBoundingClientRect();
      const r = contentEl.getBoundingClientRect();
      cx = r.left - cRect.left + r.width / 2;
      cy = r.top - cRect.top + r.height / 2;
      ringR = Math.max(r.width, r.height) / 2 + RING_MARGIN;
    };

    const resize = () => {
      dpr = Math.min(DPR_MAX, devicePixelRatio || 1);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      calcGeometry();
      seed();
    };

    const seed = () => {
      stars = [];
      for (let i = 0; i < STAR_COUNT; i++) {
        const theta = (i / STAR_COUNT) * Math.PI * 2 + Math.random() * 0.03;
        const r = ringR + (Math.random() - 0.5) * RING_THICKNESS;
        const x = cx + Math.cos(theta) * r;
        const y = cy + Math.sin(theta) * r;

        const tx = -Math.sin(theta);
        const ty = Math.cos(theta);
        const speed = TANGENTIAL_SPEED * (0.8 + Math.random() * 0.4);

        stars.push({
          x,
          y,
          vx: tx * speed,
          vy: ty * speed,
          tw: Math.random() * Math.PI * 2,
          z: 0.3 + Math.random() * 0.7,
        });
      }
    };

    const step = (t = 0) => {
      if (paused) return;
      const dt = Math.min(0.033, (t - lastT) / 1000 || 0.016);
      lastT = t;

      ctx.clearRect(0, 0, w, h);

      for (const s of stars) {
        const dx = s.x - cx;
        const dy = s.y - cy;
        const r = Math.hypot(dx, dy) || 1;

        const radialErr = r - ringR;
        const rx = (dx / r) * radialErr;
        const ry = (dy / r) * radialErr;
        const ax = -RADIAL_SPRING * rx;
        const ay = -RADIAL_SPRING * ry;

        s.vx = (s.vx + ax * dt) * (1 - DRAG * dt);
        s.vy = (s.vy + ay * dt) * (1 - DRAG * dt);

        s.x += s.vx * dt;
        s.y += s.vy * dt;

        const tw = TWINKLE * Math.sin(s.tw + t * 0.003);
        const size = s.z * 2.2 + tw;
        const light = 74 + s.z * 24 + tw * 18;
        ctx.globalAlpha = 0.8 + s.z * 0.28;
        ctx.fillStyle = `hsl(0 0% ${light}%)`;
        ctx.fillRect(s.x, s.y, size, size);
      }

      anim = requestAnimationFrame(step);
    };

    const visibility = () => {
      const hidden = document.hidden || prefersReduced;
      paused = hidden;
      if (hidden && anim) cancelAnimationFrame(anim);
      else {
        lastT = performance.now();
        anim = requestAnimationFrame(step);
      }
    };

    new ResizeObserver(() => resize()).observe(canvas);
    new ResizeObserver(() => calcGeometry()).observe(contentEl);
    addEventListener('scroll', calcGeometry, { passive: true });

    resize();
    document.addEventListener('visibilitychange', visibility, { passive: true });
    visibility();
  })();

  // Projects -> compact card list
  fetch('projects.json')
    .then((r) => r.json())
    .then((items) => {
      const list = document.getElementById('projectsList');
      list.innerHTML = '';
      items.forEach((p) => {
        const li = document.createElement('li');
        li.className = 'card-item reveal';
        const hue =
          p.tags && p.tags.length
            ? Math.abs(
                p.tags[0].split('').reduce((a, c) => a + c.charCodeAt(0), 0)
              ) % 360
            : 245;
        li.style.setProperty('--avatar-h', hue);

        li.innerHTML = `
          <div class="avatar" aria-hidden="true">
            ${p.image
              ? `<img src="${p.image}" alt="" loading="lazy">`
              : `<span>${(p.name[0] || 'P')}</span>`}
          </div>
          <div class="content">
            <div class="title"><a href="${p.url}" target="_blank" rel="noopener">${p.name}</a></div>
            <div class="subtitle">${p.description}</div>
          </div>
          <div class="meta">${(p.tags || []).slice(0, 2).join(' · ') || '—'}</div>
        `;
        list.appendChild(li);
      });
    })
    .catch(() => {
      document.getElementById('projectsList').innerHTML = `
        <li class="card-item">
          <div class="avatar">?</div>
          <div class="content">
            <div class="title">Add projects.json</div>
            <div class="subtitle">Your projects will appear here.</div>
          </div>
          <div class="meta">—</div>
        </li>`;
    });

  // Inject initials into avatars
  document.querySelectorAll('.card-item').forEach((li) => {
    const logo = li.getAttribute('data-logo') || '';
    const hue = li.getAttribute('data-accent') || '245';
    li.style.setProperty('--avatar-h', hue);
    const av = li.querySelector('.avatar');
    const hasImg = !!av?.querySelector('img');
    if (av && !hasImg && !av.textContent.trim()) {
      av.textContent = logo.slice(0, 2).toUpperCase();
    }
  });


  // Experience badges
  (() => {
    const professionalYears = 3.3;
    const hobbyYears = 17;

    const heroBox = document.getElementById('expSummary');
    heroBox.innerHTML = `
      <span class="badge"><span class="dot" aria-hidden="true"></span>${hobbyYears} yrs hobbyist</span>
      <span class="badge"><span class="dot" aria-hidden="true"></span>${professionalYears} yrs professional</span>
    `;

  })();
})();
