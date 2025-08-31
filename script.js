(function () {
  const root = document.documentElement;

  // Theme toggle.
  const stored = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = stored || (prefersDark ? 'dark' : 'light');
  if (theme === 'dark') root.setAttribute('data-theme', 'dark');
  document.getElementById('themeToggle')?.addEventListener('click', () => {
    const isDark = root.getAttribute('data-theme') === 'dark';
    root.setAttribute('data-theme', isDark ? 'light' : 'dark');
    localStorage.setItem('theme', isDark ? 'light' : 'dark');
  });

  // Year.
  document.getElementById('year').textContent = new Date().getFullYear();

  // Active section nav.
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

  // Smooth hash navigation.
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

  // Starfield: circular ring around hero content.
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
    const TANGENTIAL_SPEED = 85;  // base per-star tangential speed (px/s).
    const RADIAL_SPRING = 2.0;    // spring toward ring radius.
    const DRAG = 0.03;            // slowdown between boosts.
    const TWINKLE = 0.22;
    const DPR_MAX = 2;

    // Periodic "reheat + reverse" settings (ms).
    const PERIOD_MS = 20000;      // every 20 seconds.
    const RAMP_MS   = 2000;       // ramp duration.
    const RAMP_START = PERIOD_MS - RAMP_MS;

    let w = 0, h = 0, dpr = 1;
    let cx = 0, cy = 0;
    let ringR = 200;
    let stars = [];
    let anim, lastT = 0, paused = prefersReduced;
    let t0 = null; // first animation timestamp.

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
        const speed = TANGENTIAL_SPEED * (0.8 + Math.random() * 0.4); // per-star variance.

        stars.push({
          x, y,
          vx: tx * speed,
          vy: ty * speed,
          baseSpeed: speed, // store original speed magnitude.
          tw: Math.random() * Math.PI * 2,
          z: 0.3 + Math.random() * 0.7,
        });
      }
    };

    const step = (t = 0) => {
      if (paused) return;
      if (t0 === null) t0 = t;
      const dt = Math.min(0.033, (t - lastT) / 1000 || 0.016);
      lastT = t;

      // Periodic timing.
      const elapsed = t - t0;                 // ms since start.
      const phase = elapsed % PERIOD_MS;      // 0..PERIOD_MS.
      const cycleIndex = Math.floor(elapsed / PERIOD_MS);
      const reverseDir = (cycleIndex % 2 === 0) ? 1 : -1; // flip direction every cycle.

      // Ramp factor: 0 outside ramp window, 0→1 within last RAMP_MS.
      const alpha = Math.max(0, Math.min(1, (phase - RAMP_START) / RAMP_MS));

      ctx.clearRect(0, 0, w, h);

      for (const s of stars) {
        const dx = s.x - cx;
        const dy = s.y - cy;
        const r = Math.hypot(dx, dy) || 1;

        // Radial spring toward ring.
        const radialErr = r - ringR;
        const rx = (dx / r) * radialErr;
        const ry = (dy / r) * radialErr;
        const ax = -RADIAL_SPRING * rx;
        const ay = -RADIAL_SPRING * ry;

        // Integrate velocity with drag (so they slow between boosts).
        s.vx = (s.vx + ax * dt) * (1 - DRAG * dt);
        s.vy = (s.vy + ay * dt) * (1 - DRAG * dt);

        // Decompose velocity into radial/tangential components.
        const rlen = Math.hypot(dx, dy) || 1;
        const rxu = dx / rlen, ryu = dy / rlen; // radial unit.
        const txu = -ryu,   tyu =  rxu;         // tangential unit (CCW).

        const vr = s.vx * rxu + s.vy * ryu;     // radial speed (keep as-is).
        const vt = s.vx * txu + s.vy * tyu;     // current tangential speed (signed).

        // Target tangential speed: original magnitude but flipped each cycle.
        const vtTarget = reverseDir * s.baseSpeed;

        // Lerp tangential toward vtTarget only during ramp window.
        const vtBoosted = vt + (vtTarget - vt) * alpha;

        // Recompose velocity.
        s.vx = txu * vtBoosted + rxu * vr;
        s.vy = tyu * vtBoosted + ryu * vr;

        // Integrate position.
        s.x += s.vx * dt;
        s.y += s.vy * dt;

        // Draw star.
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
      if (hidden) {
        paused = true;
        if (anim) cancelAnimationFrame(anim);
      } else {
        paused = false;
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

  // Projects -> compact card list.
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
            ? Math.abs(p.tags[0].split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % 360
            : 245;
        li.style.setProperty('--avatar-h', hue);

        li.innerHTML = `
          <div class="avatar" aria-hidden="true">
            ${p.image ? `<img src="${p.image}" alt="" loading="lazy">` : `<span>${(p.name[0] || 'P')}</span>`}
          </div>
          <div class="content">
            <div class="title"><a href="${p.url}" target="_blank" rel="noopener">${p.name}</a></div>
            <div class="subtitle">${p.description}</div>
          </div>
          <div class="meta">${(p.tags || []).slice(0, 2).join(' · ') || '-'}</div>
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
          <div class="meta">-</div>
        </li>`;
    });

  // Writing -> compact card list.
  fetch('writing.json')
    .then((r) => r.json())
    .then((items) => {
      const list = document.getElementById('writingList');
      if (!list) return;
      list.innerHTML = '';
      items
        .sort((a, b) => b.date.localeCompare(a.date))
        .forEach((p) => {
          const li = document.createElement('li');
          li.className = 'card-item reveal';
          li.setAttribute('data-logo', '✍');
          li.setAttribute('data-accent', '250');
          li.innerHTML = `
            <div class="avatar"></div>
            <div class="content">
              <div class="title"><a href="${p.url}">${p.title}</a></div>
              <div class="subtitle">${p.summary}</div>
            </div>
            <div class="meta">${new Date(p.date).toLocaleDateString()} · ${p.readingMinutes} min</div>
          `;
          list.appendChild(li);
        });
    })
    .catch(() => {
      const list = document.getElementById('writingList');
      if (list) {
        list.innerHTML = `
          <li class="card-item">
            <div class="avatar">✍</div>
            <div class="content">
              <div class="title">Add writing.json</div>
              <div class="subtitle">Your essays will appear here.</div>
            </div>
            <div class="meta">-</div>
          </li>`;
      }
    });

  // Inject initials into avatars.
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

  // Experience badges.
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
