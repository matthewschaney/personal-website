(function () {
  const root = document.documentElement;
  const stored = localStorage.getItem('theme');
  const prefersDark = window.matchMedia(
    '(prefers-color-scheme: dark)'
  ).matches;

  const theme = stored || (prefersDark ? 'dark' : 'light');
  if (theme === 'dark') root.setAttribute('data-theme', 'dark');

  const toggle = document.getElementById('themeToggle');
  toggle?.addEventListener('click', () => {
    const isDark = root.getAttribute('data-theme') === 'dark';
    root.setAttribute('data-theme', isDark ? 'light' : 'dark');
    localStorage.setItem('theme', isDark ? 'light' : 'dark');
  });

  document.getElementById('year').textContent =
    new Date().getFullYear();

  fetch('projects.json')
    .then(r => r.json())
    .then(projects => {
      const grid = document.getElementById('projectsGrid');
      projects.forEach(p => {
        const card = document.createElement('article');
        card.className = 'card';
        card.innerHTML = `
          <h3>
            <a href="${p.url}" target="_blank" rel="noopener">
              ${p.name}
            </a>
          </h3>
          <p>${p.description}</p>
          ${
            p.image
              ? `<img src="${p.image}" alt="${p.name} screenshot">`
              : ''
          }
          <div class="tags">
            ${p.tags.map(t => `<span class="tag">${t}</span>`).join('')}
          </div>
        `;
        grid.appendChild(card);
      });
    })
    .catch(() => {
      document.getElementById('projectsGrid').innerHTML = `
        <p class="muted">
          Add your projects to projects.json to see them here.
        </p>
      `;
    });
})();
