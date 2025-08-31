# Personal Website

My personal portfolio and website — lightweight, fast, and accessible. Built with plain HTML/CSS/JS, no build step required.  

Deployed at [schaney.net](https://schaney.net).

---

## 🚀 Getting Started

```bash
# Clone
git clone git@github.com:<username>/portfolio.git
cd portfolio

# Preview locally
open index.html
```

To customize:
1. Edit content in `index.html` (name, bio, links).
2. Update `projects.json` with real projects.
3. Drop a PDF résumé in `assets/YourName_Resume.pdf`.
4. Replace icons in `assets/` (`favicon.svg`, `og-image.png`).

---

## 🌍 Deployment

This site is static — deploy anywhere:

- **GitHub Pages**: push to `main`, enable Pages, and (optional) add `CNAME` with your domain.  
- **Netlify**: drag-and-drop the folder, or connect via Git.  
- **Vercel**: `vercel --prod` with output dir set to project root.  

Custom domain: [schaney.net](https://schaney.net).

---

## 📂 Structure

```
.
├── index.html        # main page
├── styles.css        # styles
├── script.js         # behavior (dark mode, projects)
├── projects.json     # projects list
├── assets/           # icons, résumé, images
└── LICENSE           # MIT (code), CC BY (content)
```

---

## 🔮 Roadmap

- [ ] Blog (Markdown → static)  
- [ ] Project filters & search  
- [ ] Privacy-friendly analytics (e.g. Plausible, Umami)  
- [ ] CI checks (accessibility, Lighthouse)  

---

## 📜 License

- **Code**: MIT  
- **Content (writing, images)**: CC BY 4.0  

---

_Updated: 2025-08-31_  
