window.Site = (function () {
  const root = document.documentElement;

  const isDarkTheme = () => root.getAttribute("data-theme") === "dark";
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

  const isImagePath = (v) =>
    typeof v === "string" && /(^\/|^https?:|\.svg$|\.png$|\.jpe?g$|\.webp$)/i.test(v);

  const getInitials = (str = "") =>
    str.trim().split(/\s+/).map(w => w[0] || "").join("").slice(0, 2).toUpperCase();

  const fmtDateMDY = (iso) => {
    if (!iso) return "";
    const [y, m, d] = String(iso).split("-");
    return `${m.padStart(2, "0")}/${d.padStart(2, "0")}/${y}`;
  };

  const year = (iso) => (iso ? String(iso).slice(0, 4) : "");

  const fmtRangeYears = (start, end) =>
    `${year(start)} - ${end ? year(end) : "Present"}`;

  const cache = new Map();
  async function getJSON(url, { signal } = {}) {
    if (cache.has(url)) return cache.get(url);
    const resp = await fetch(url, { signal, headers: { "Accept": "application/json" } });
    if (!resp.ok) throw new Error(`Failed to fetch ${url}: ${resp.status}`);
    const data = await resp.json();
    cache.set(url, data);
    return data;
  }

  function injectAvatarInitials(scopeEl = document) {
    $$(".card-item", scopeEl).forEach((li) => {
      const logo = li.getAttribute("data-logo") || "";
      const hue = li.getAttribute("data-accent") || "245";
      li.style.setProperty("--avatar-h", hue);
      const av = $(".avatar", li);
      const hasImg = !!$("img", av);
      if (av && !hasImg && !av.textContent.trim()) {
        av.textContent = logo.slice(0, 2).toUpperCase();
      }
    });
  }

  function renderCards(listEl, items, mapItemToCard) {
    if (!listEl) return;
    listEl.innerHTML = "";
    for (const item of items) {
      const li = document.createElement("li");
      li.className = "card-item reveal";
      const { title, subtitle, meta, logo, accent, img } = mapItemToCard(item);
      li.setAttribute("data-logo", logo || "");
      li.setAttribute("data-accent", String(accent ?? "245"));
      li.innerHTML = `
        <div class="avatar" aria-hidden="true">
          ${img ? `<img src="${img}" alt="" loading="lazy">` : ``}
        </div>
        <div class="content">
          <div class="title">${title}</div>
          <div class="subtitle">${subtitle || ""}</div>
        </div>
        <div class="meta">${meta || "-"}</div>
      `;
      listEl.appendChild(li);
    }
    injectAvatarInitials(listEl);
    listEl.setAttribute("aria-busy", "false");
  }

  function initTheme() {
    const stored = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = stored || (prefersDark ? "dark" : "light");
    root.setAttribute("data-theme", theme);
    $("#themeToggle")?.addEventListener("click", () => {
      const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      localStorage.setItem("theme", next);
      root.dispatchEvent(new CustomEvent("themechange", { detail: { theme: next } }));
    });
  }

  function initYear() {
    const y = $("#year");
    if (y) y.textContent = new Date().getFullYear();
  }

  function initActiveSectionNav() {
    const sections = $$(".hero, main .section");
    const navlinks = $$('.nav a[href^="#"]');
    const setActive = (id) =>
      navlinks.forEach((a) => a.setAttribute("aria-current", a.getAttribute("href") === id ? "true" : "false"));
    const io = new IntersectionObserver((entries) => {
      const v = entries.filter(e => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!v) return;
      setActive("#" + v.target.id);
    }, { rootMargin: "-40% 0px -55% 0px", threshold: [0, .25, .5, .75, 1] });
    sections.forEach((s) => io.observe(s));
    $$('.nav a[href^="#"]').forEach((a) => {
      a.addEventListener("click", (e) => {
        const href = a.getAttribute("href");
        const t = document.querySelector(href);
        if (!t) return;
        e.preventDefault();
        const go = () => {
          t.scrollIntoView({ behavior: "instant" });
          history.pushState(null, "", href);
          setActive(href);
        };
        if (document.startViewTransition) document.startViewTransition(go);
        else { t.scrollIntoView({ behavior: "smooth" }); history.pushState(null, "", href); }
      });
    });
  }

  function initStars() {
    const canvas = $("#stars");
    const contentEl = $(".hero .container");
    if (!canvas || !contentEl) return;

    let dark = isDarkTheme();
    const prefersReduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = canvas.getContext("2d", { alpha: true });

    const STAR_COUNT = 260;
    const STAR_BASE_SIZE = 2.2;
    const STAR_SIZE_SCALE = 1.5;
    const RING_MARGIN = 90;
    const RING_THICKNESS = 70;
    const TANGENTIAL_SPEED = 85;
    const RADIAL_SPRING = 2.3;
    const DRAG = 0.03;
    const TWINKLE = 0.22;
    const DPR_MAX = 2;

    const PEER_RADIUS = 80;
    const PEER_FORCE = 260;
    const SOFTENING = 120;

    const PERIOD_MS = 20000;
    const RAMP_MS = 2000;
    const RAMP_START = PERIOD_MS - RAMP_MS;

    let w = 0, h = 0, dpr = 1;
    let cx = 0, cy = 0;
    let ringR = 200;
    let stars = [];
    let anim, lastT = 0, paused = prefersReduced;
    let t0 = null;

    root.addEventListener("themechange", (e) => {
      dark = e.detail?.theme === "dark";
      ctx.clearRect(0, 0, w, h);
    });

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
        const size = STAR_BASE_SIZE * (0.8 + Math.random() * 0.6) * STAR_SIZE_SCALE;
        stars.push({ x, y, vx: tx * speed, vy: ty * speed, baseSpeed: speed, tw: Math.random() * Math.PI * 2, z: 0.3 + Math.random() * 0.7, size });
      }
    };

    const step = (t = 0) => {
      if (paused) return;
      if (t0 === null) t0 = t;
      const dt = Math.min(0.033, (t - lastT) / 1000 || 0.016);
      lastT = t;

      const elapsed = t - t0;
      const phase = elapsed % PERIOD_MS;
      const cycleIndex = Math.floor(elapsed / PERIOD_MS);
      const currDir = cycleIndex % 2 === 0 ? 1 : -1;
      const nextDir = -currDir;
      const a = Math.max(0, Math.min(1, (phase - RAMP_START) / RAMP_MS));
      const ease = a * a * (3 - 2 * a);
      const targetDir = currDir * (1 - ease) + nextDir * ease;
      const drive = a * 0.95 + 0.05;

      const n = stars.length;
      const ax = new Float32Array(n);
      const ay = new Float32Array(n);

      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const dx = stars[j].x - stars[i].x;
          const dy = stars[j].y - stars[i].y;
          const r2 = dx * dx + dy * dy + SOFTENING;
          const r = Math.sqrt(r2);
          if (r > PEER_RADIUS) continue;
          const invR = 1 / (r || 1);
          const nx = dx * invR;
          const ny = dy * invR;
          const s = (PEER_FORCE * (1 - r / PEER_RADIUS)) / r2;
          const fx = s * nx;
          const fy = s * ny;
          ax[i] -= fx; ay[i] -= fy;
          ax[j] += fx; ay[j] += fy;
        }
      }

      ctx.clearRect(0, 0, w, h);

      for (let i = 0; i < n; i++) {
        const s = stars[i];

        const dx = s.x - cx, dy = s.y - cy;
        const r = Math.hypot(dx, dy) || 1;
        const rx = dx / r, ry = dy / r;
        const radialErr = r - ringR;
        const axSpring = -RADIAL_SPRING * rx * radialErr;
        const aySpring = -RADIAL_SPRING * ry * radialErr;

        s.vx = (s.vx + (ax[i] + axSpring) * dt) * (1 - DRAG * dt);
        s.vy = (s.vy + (ay[i] + aySpring) * dt) * (1 - DRAG * dt);

        const vr = s.vx * rx + s.vy * ry;
        const txu = -ry, tyu = rx;
        const vt = s.vx * txu + s.vy * tyu;
        const vtTarget = targetDir * s.baseSpeed;
        const vtBoosted = vt + (vtTarget - vt) * drive;
        s.vx = txu * vtBoosted + rx * vr;
        s.vy = tyu * vtBoosted + ry * vr;

        s.x += s.vx * dt;
        s.y += s.vy * dt;

        const tw = TWINKLE * Math.sin(s.tw + t * 0.003);
        const size = s.size + tw;
        const lightness = dark ? 74 + s.z * 24 + tw * 18 : 12 + (1 - s.z) * 10 + tw * 6;

        ctx.globalAlpha = 0.8 + s.z * 0.28;
        ctx.fillStyle = `hsl(0 0% ${lightness}%)`;
        ctx.fillRect(s.x, s.y, size, size);
      }

      anim = requestAnimationFrame(step);
    };

    const visibility = () => {
      const hidden = document.hidden || matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (hidden) { anim && cancelAnimationFrame(anim); }
      else { lastT = performance.now(); anim = requestAnimationFrame(step); }
    };

    new ResizeObserver(() => resize()).observe(canvas);
    new ResizeObserver(() => calcGeometry()).observe(contentEl);
    addEventListener("scroll", calcGeometry, { passive: true });

    resize();
    document.addEventListener("visibilitychange", visibility, { passive: true });
    visibility();
  }

  async function renderProjects() {
    const list = $("#projectsList");
    if (!list) return;
    list.setAttribute("aria-busy", "true");
    try {
      const items = await getJSON("data/projects.json");
      renderCards(list, items, (p) => {
        const hue = (p.tags && p.tags.length
          ? Math.abs(p.tags[0].split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % 360
          : 245);
        const title = `<a href="${p.url}" target="_blank" rel="noopener noreferrer">${p.name}</a>`;
        return {
          title,
          subtitle: p.description,
          meta: (p.tags || []).slice(0, 2).join(" · ") || "-",
          logo: (p.image && !isImagePath(p.image)) ? p.image : (p.name?.[0] || "P"),
          accent: hue,
          img: isImagePath(p.image) ? p.image : null
        };
      });
    } catch {
      list.innerHTML = `<li class="card-item"><div class="avatar">?</div><div class="content"><div class="title">Could not load projects.json</div><div class="subtitle">Verify /data/projects.json exists and is valid JSON.</div></div><div class="meta">-</div></li>`;
      list.setAttribute("aria-busy", "false");
    }
  }

  async function renderExperienceAndBadges() {
    const list = $("#experienceList");
    if (!list) return;
    list.setAttribute("aria-busy", "true");
    try {
      const items = await getJSON("data/experience.json");
      renderCards(list, items, (e) => {
        const useImg = isImagePath(e.image);
        const initials = (useImg ? getInitials(e.company || "") : e.image || getInitials(e.company || "")).slice(0, 2).toUpperCase();
        return {
          title: `${e.role} - ${e.company}`,
          subtitle: e.subtitle || "",
          meta: fmtRangeYears(e.start, e.end),
          logo: initials,
          accent: e.accent ?? 245,
          img: useImg ? e.image : null
        };
      });

      const now = new Date();
      const months = items
        .filter(e => Array.isArray(e.classes) && e.classes.includes("exp-role"))
        .map(e => {
          const start = new Date(e.start);
          const end = e.end ? new Date(e.end) : now;
          return Math.max(0, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()));
        })
        .reduce((a, b) => a + b, 0);

      const professionalYears = Math.round((months / 12) * 10) / 10;

      const heroBox = $("#expSummary");
      if (heroBox) {
        const HOBBY_STARTED_YEAR = 2008;
        const hobbyYears = now.getFullYear() - HOBBY_STARTED_YEAR;
        heroBox.innerHTML = `
          <span class="badge"><span class="dot" aria-hidden="true"></span>${hobbyYears} yrs hobbyist</span>
          <span class="badge"><span class="dot" aria-hidden="true"></span>${professionalYears} yrs professional</span>
        `;
      }

      const inline = $("#expInline");
    } catch {
      list.innerHTML = ``;
      list.setAttribute("aria-busy", "false");
    }
  }

  async function renderEducation() {
    const list = $("#educationList");
    if (!list) return;
    list.setAttribute("aria-busy", "true");
    try {
      const items = await getJSON("data/education.json");
      renderCards(list, items, (ed) => {
        const useImg = isImagePath(ed.image);
        const initials = (useImg ? getInitials(ed.school || "") : ed.image || getInitials(ed.school || "")).slice(0, 2).toUpperCase();
        return {
          title: ed.school,
          subtitle: ed.degree,
          meta: fmtRangeYears(ed.start, ed.end),
          logo: initials,
          accent: ed.accent ?? 245,
          img: useImg ? ed.image : null
        };
      });
    } catch {
      list.innerHTML = ``;
      list.setAttribute("aria-busy", "false");
    }
  }

  async function renderWritingOnHome() {
    const list = $("#writingList");
    if (!list) return;
    list.setAttribute("aria-busy", "true");
    try {
      const items = (await getJSON("data/writing.json"))
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date));

      renderCards(list, items, (p) => ({
        title: `<a href="${p.url}">${p.title}</a>`,
        subtitle: p.summary,
        meta: `${fmtDateMDY(p.date)} · ${p.readingMinutes} min`,
        logo: "✍",
        accent: 250,
        img: null
      }));
    } catch {
      list.innerHTML = `<li class="card-item"><div class="avatar">✍</div><div class="content"><div class="title">No essays yet</div><div class="subtitle">Add <code>/data/writing.json</code> to show posts.</div></div><div class="meta">-</div></li>`;
      list.setAttribute("aria-busy", "false");
    }
  }

  async function renderWritingIndex() {
    const list = $("#writingIndex");
    if (!list) return;
    list.setAttribute("aria-busy", "true");
    try {
      const items = (await getJSON("/data/writing.json"))
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date));

      renderCards(list, items, (p) => ({
        title: `<a href="${p.url}">${p.title}</a>`,
        subtitle: p.summary,
        meta: `${fmtDateMDY(p.date)} · ${p.readingMinutes} min`,
        logo: "✍",
        accent: 250,
        img: null
      }));
    } catch {
      list.innerHTML = `<li class="card-item"><div class="avatar">✍</div><div class="content"><div class="title">Could not load writing.json</div><div class="subtitle">Ensure the file exists and is valid JSON.</div></div><div class="meta">-</div></li>`;
      list.setAttribute("aria-busy", "false");
    }
  }

  function initHome() {
    initTheme();
    initYear();
    initActiveSectionNav();
    initStars();
    renderProjects();
    renderExperienceAndBadges();
    renderEducation();
    renderWritingOnHome();
    injectAvatarInitials(document);
  }

  window.addEventListener("DOMContentLoaded", initHome);

  return {
    renderWritingIndex
  };
})();
