#!/usr/bin/env node
/**
 * CoolDown F1 — Build Script
 * ==========================
 * Genera al momento del deploy:
 *   - Una pagina HTML per ogni articolo in content/articles/*.md
 *   - sitemap.xml con tutti gli URL del sito
 *   - robots.txt
 *
 * Le pagine vengono salvate in articoli/<slug>.html
 *
 * Si esegue su Cloudflare Pages come build command: `node build.js`
 * (Vedi README.md per come configurarlo)
 */

const fs = require('fs');
const path = require('path');

// ============================================================
// CONFIG
// ============================================================
const SITE_URL = process.env.SITE_URL || 'https://cooldown-f1.pages.dev';
const ARTICLES_DIR = 'content/articles';
const OUTPUT_DIR = 'articoli';
const SITE_NAME = 'CoolDown · F1';

// ============================================================
// HELPERS
// ============================================================
function escapeHTML(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function escapeAttr(s) {
  return String(s ?? '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatDate(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return String(iso || '');
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getFullYear()).slice(-2)}`;
}

function slugify(s) {
  return String(s).toLowerCase()
    .replace(/[àáâãä]/g, 'a').replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i').replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u').replace(/[ç]/g, 'c').replace(/[ñ]/g, 'n')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

// Minimal markdown to HTML (matches what's used in the modal of the original site)
function markdownToHTML(md) {
  let html = String(md || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, s => `<ul>${s}</ul>`);
  html = html.split(/\n{2,}/).map(block => {
    block = block.trim();
    if (!block) return '';
    if (/^<(h[23]|ul|li|p)/.test(block)) return block;
    return `<p>${block.replace(/\n/g, ' ')}</p>`;
  }).join('\n');
  return html;
}

function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return null;
  const fm = {};
  m[1].split('\n').forEach(line => {
    const i = line.indexOf(':');
    if (i < 0) return;
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    if (k) fm[k] = v;
  });
  fm.body = m[2].trim();
  return fm;
}

// ============================================================
// READ ARTICLES
// ============================================================
function readArticles() {
  if (!fs.existsSync(ARTICLES_DIR)) {
    console.log(`[build] ${ARTICLES_DIR} non esiste, salto generazione articoli`);
    return [];
  }
  const files = fs.readdirSync(ARTICLES_DIR).filter(f => f.endsWith('.md'));
  const articles = [];
  for (const f of files) {
    try {
      const text = fs.readFileSync(path.join(ARTICLES_DIR, f), 'utf-8');
      const data = parseFrontmatter(text);
      if (!data || !data.title) {
        console.warn(`[build] ${f}: frontmatter mancante o senza title, salto`);
        continue;
      }
      // Slug: dal filename (rimuove la data se presente: 2026-05-12-titolo.md → titolo)
      const baseName = f.replace(/\.md$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, '');
      data.slug = slugify(baseName) || slugify(data.title);
      articles.push(data);
    } catch (e) {
      console.error(`[build] errore lettura ${f}:`, e.message);
    }
  }
  // Ordina per data decrescente
  articles.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return articles;
}

// ============================================================
// ARTICLE PAGE TEMPLATE
// ============================================================
function renderArticlePage(article, allArticles) {
  const a = article;
  const url = `${SITE_URL}/${OUTPUT_DIR}/${a.slug}.html`;
  const ogImage = a.cover ? `${SITE_URL}${a.cover}` : `${SITE_URL}/images/og-default.png`;
  const description = (a.excerpt || a.title).slice(0, 160);

  // Articoli correlati: 3 dello stesso tag, esclusi se stesso
  const related = allArticles
    .filter(x => x.slug !== a.slug && (x.tag || '').toLowerCase() === (a.tag || '').toLowerCase())
    .slice(0, 3);

  const variant = ['ac-v0','ac-v1','ac-v2'].includes(a.variant) ? a.variant : 'ac-v0';
  const hasCover = !!a.cover;

  // JSON-LD Schema.org per rich snippets Google
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: a.title,
    description: description,
    image: ogImage,
    datePublished: a.date,
    dateModified: a.date,
    author: { '@type': 'Organization', name: 'CoolDown F1' },
    publisher: {
      '@type': 'Organization',
      name: 'CoolDown F1',
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/images/logo.png` }
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    articleSection: a.tag || 'Articoli'
  };

  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<meta name="theme-color" content="#0033FF" />

<!-- SEO basics -->
<title>${escapeHTML(a.title)} · ${SITE_NAME}</title>
<meta name="description" content="${escapeAttr(description)}" />
<meta name="author" content="CoolDown F1" />
<link rel="canonical" href="${url}" />

<!-- Open Graph (Facebook/Instagram/WhatsApp/LinkedIn preview) -->
<meta property="og:type" content="article" />
<meta property="og:title" content="${escapeAttr(a.title)}" />
<meta property="og:description" content="${escapeAttr(description)}" />
<meta property="og:image" content="${ogImage}" />
<meta property="og:url" content="${url}" />
<meta property="og:site_name" content="CoolDown F1" />
<meta property="og:locale" content="it_IT" />
<meta property="article:published_time" content="${a.date}T00:00:00Z" />
<meta property="article:section" content="${escapeAttr(a.tag || '')}" />

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeAttr(a.title)}" />
<meta name="twitter:description" content="${escapeAttr(description)}" />
<meta name="twitter:image" content="${ogImage}" />

<!-- Schema.org JSON-LD -->
<script type="application/ld+json">${JSON.stringify(schema)}</script>

<!-- Fonts -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600;700&family=IBM+Plex+Sans+Condensed:wght@400;500;600;700&family=IBM+Plex+Serif:ital,wght@1,400&display=swap" rel="stylesheet" />

<style>
/* ===== BASE ===== */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; -webkit-text-size-adjust: 100%; }
:root {
  --blue:#0033FF; --blue-deep:#001580; --paper:#F2F1ED; --paper-warm:#EBEAE4;
  --ink:#0A0A0A; --ink-soft:#1A1A1A; --mid:#555; --mid-soft:#999; --red:#FF2200;
  --fs-micro:0.5rem; --fs-tiny:0.6rem; --fs-body:0.95rem;
  --pad-x:1.25rem; --gutter:1rem;
}
@media (min-width: 768px)  { :root { --pad-x:2.5rem; --gutter:1.5rem; } }
@media (min-width: 1200px) { :root { --pad-x:4rem; } }

body { font-family:'IBM Plex Mono','Courier New',Courier,monospace; font-size:var(--fs-body); background:var(--paper); color:var(--ink); line-height:1.6; -webkit-font-smoothing:antialiased; }
::selection { background:var(--blue); color:var(--paper); }

/* ===== NAV ===== */
nav { position:fixed; top:0; left:0; right:0; z-index:500; height:60px; background:rgba(10,10,10,0.96); backdrop-filter:blur(8px); display:flex; align-items:center; justify-content:space-between; padding:0 var(--pad-x); padding-left:max(var(--pad-x), env(safe-area-inset-left)); padding-right:max(var(--pad-x), env(safe-area-inset-right)); border-bottom:1px solid var(--blue); }
.nav-logo { font-family:'IBM Plex Sans Condensed',sans-serif; font-size:1.2rem; font-weight:700; letter-spacing:-.5px; color:var(--paper); text-transform:uppercase; display:flex; align-items:center; gap:9px; text-decoration:none; }
.nav-logo::before { content:''; display:block; width:9px; height:9px; background:var(--blue); animation:blink 1.4s steps(2) infinite; }
@keyframes blink { 50% { opacity:.2; } }
.nav-logo span { color:var(--blue); }
.nav-links { display:none; gap:2rem; list-style:none; }
@media (min-width: 880px) { .nav-links { display:flex; } }
.nav-links a { font-size:.68rem; font-weight:500; letter-spacing:.24em; color:rgba(242,241,237,0.55); text-decoration:none; text-transform:uppercase; position:relative; transition:color .2s; }
.nav-links a:hover, .nav-links a.is-current { color:var(--paper); }
.nav-links a::after { content:''; position:absolute; left:0; bottom:-12px; width:0; height:1px; background:var(--blue); transition:width .25s; }
.nav-links a:hover::after, .nav-links a.is-current::after { width:100%; }
.nav-toggle { display:flex; flex-direction:column; gap:4px; cursor:pointer; background:none; border:none; padding:4px; }
@media (min-width: 880px) { .nav-toggle { display:none; } }
.nav-toggle span { display:block; width:22px; height:2px; background:var(--paper); }
.nav-drawer { position:fixed; top:60px; left:0; right:0; bottom:0; background:var(--ink); z-index:499; padding:3rem var(--pad-x); padding-bottom:max(3rem, env(safe-area-inset-bottom)); overflow-y:auto; transform:translateX(100%); transition:transform .4s cubic-bezier(.7,0,.3,1); }
.nav-drawer.open { transform:translateX(0); }
.nav-drawer a { display:block; font-family:'IBM Plex Sans Condensed',sans-serif; font-size:2.2rem; font-weight:700; color:var(--paper); text-decoration:none; text-transform:uppercase; padding:.6rem 0; border-bottom:1px solid rgba(255,255,255,.1); letter-spacing:-1px; }

/* ===== HERO ARTICOLO ===== */
.art-hero {
  background: var(--blue);
  color: var(--paper);
  padding-top: 96px;
  padding-bottom: 0;
  padding-left: var(--pad-x);
  padding-right: var(--pad-x);
  position: relative;
  overflow: hidden;
}
.art-hero::before { content:''; position:absolute; inset:0; background-image:radial-gradient(circle, rgba(242,241,237,.18) 1.5px, transparent 1.8px); background-size:18px 18px; pointer-events:none; }
.art-hero-inner { position:relative; z-index:1; max-width:920px; margin: 0 auto; padding-bottom: 2.5rem; }

.crumb { display:inline-flex; align-items:center; gap:.7rem; font-size:var(--fs-micro); letter-spacing:.25em; color:rgba(242,241,237,.55); text-transform:uppercase; margin-bottom:1.5rem; flex-wrap:wrap; }
.crumb a { color:rgba(242,241,237,.55); text-decoration:none; transition:color .2s; }
.crumb a:hover { color:var(--paper); }
.crumb .sep { opacity:.5; }
.crumb .current { color:var(--paper); }

.art-tag { display:inline-block; font-size:var(--fs-tiny); font-weight:600; letter-spacing:.3em; color:var(--paper); text-transform:uppercase; background:var(--ink); padding:6px 12px; margin-bottom:1.5rem; }

.art-title { font-family:'IBM Plex Sans Condensed',sans-serif; font-size:clamp(2rem, 6vw, 4.5rem); font-weight:700; line-height:.95; letter-spacing:-1.5px; color:var(--paper); text-transform:uppercase; margin-bottom:1.5rem; }

.art-meta-row { display:flex; flex-wrap:wrap; gap:1.25rem; align-items:center; padding-top:1.25rem; border-top:1px solid rgba(242,241,237,.25); font-size:.75rem; letter-spacing:2px; color:rgba(242,241,237,.7); text-transform:uppercase; }
.art-meta-row .dot { width:5px; height:5px; background:var(--paper); border-radius:50%; opacity:.5; }

/* ===== COVER ===== */
.art-cover-wrap {
  background: var(--paper);
  padding: 1.5rem 0;
  position: relative;
  overflow: hidden;
}
.art-cover-wrap::before {
  content: '';
  position: absolute;
  inset: -80px;
  background-image: var(--cover-img, none);
  background-size: cover;
  background-position: center;
  filter: blur(60px) saturate(1.3);
  opacity: 0.5;
  z-index: 0;
  pointer-events: none;
}
.art-cover {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  aspect-ratio: 21/9;
  background: var(--blue);
  overflow: hidden;
}
.art-cover.has-cover {
  background-color: var(--mid-soft);
  background-size: cover;
  background-position: center;
}
.art-cover.ac-v0::before, .art-cover.ac-v1::before, .art-cover.ac-v2::before {
  content:''; position:absolute; inset:0; pointer-events:none;
}
.art-cover.ac-v0::before { background:radial-gradient(circle, rgba(242,241,237,.88) 1.5px, transparent 2px) 0 0 / 8px 8px; -webkit-mask-image:linear-gradient(135deg, transparent 15%, black 75%); mask-image:linear-gradient(135deg, transparent 15%, black 75%); }
.art-cover.ac-v1 { background: var(--ink); }
.art-cover.ac-v1::before { background:radial-gradient(circle, rgba(242,241,237,.8) 2px, transparent 2.5px) 0 0 / 10px 10px; -webkit-mask-image:radial-gradient(ellipse 60% 60% at 50% 50%, black 20%, transparent 70%); mask-image:radial-gradient(ellipse 60% 60% at 50% 50%, black 20%, transparent 70%); }
.art-cover.ac-v2 { background: var(--red); }
.art-cover.ac-v2::before { background:radial-gradient(circle, rgba(242,241,237,.75) 1px, transparent 1.5px) 0 0 / 6px 6px; -webkit-mask-image:linear-gradient(to bottom, black 0%, transparent 90%); mask-image:linear-gradient(to bottom, black 0%, transparent 90%); }

/* ===== ARTICLE BODY ===== */
.art-body-wrap { padding: 3rem var(--pad-x); padding-left:max(var(--pad-x), env(safe-area-inset-left)); padding-right:max(var(--pad-x), env(safe-area-inset-right)); }
.art-body { max-width: 720px; margin: 0 auto; }
.art-excerpt {
  font-family:'IBM Plex Serif',serif;
  font-style:italic;
  font-size:1.25rem;
  line-height:1.5;
  color:var(--ink);
  border-left:4px solid var(--blue);
  padding-left:1.25rem;
  margin-bottom:2.5rem;
}
.art-body article { font-size:1.05rem; line-height:1.8; color:var(--ink-soft); }
.art-body article p { margin-bottom:1.4rem; }
.art-body article h2 { font-family:'IBM Plex Sans Condensed',sans-serif; font-size:1.7rem; font-weight:700; text-transform:uppercase; letter-spacing:-.5px; margin:2.5rem 0 1rem; color:var(--ink); padding-bottom:.4rem; border-bottom:2px solid var(--blue); }
.art-body article h3 { font-family:'IBM Plex Sans Condensed',sans-serif; font-size:1.3rem; font-weight:700; text-transform:uppercase; letter-spacing:-.3px; margin:1.8rem 0 .7rem; color:var(--blue); }
.art-body article strong { font-weight:600; color:var(--ink); }
.art-body article em { font-style:italic; }
.art-body article a { color:var(--blue); text-decoration:underline; text-underline-offset:3px; }
.art-body article ul, .art-body article ol { padding-left:1.5rem; margin-bottom:1.4rem; }
.art-body article li { margin-bottom:.5rem; }

/* ===== SHARE ===== */
.art-share {
  max-width:720px; margin: 3rem auto 0;
  padding: 1.5rem 0;
  border-top: 1px solid rgba(0,0,0,.15);
  border-bottom: 1px solid rgba(0,0,0,.15);
  display:flex; align-items:center; flex-wrap:wrap; gap:1rem;
}
.art-share-lbl { font-size:var(--fs-micro); letter-spacing:.3em; text-transform:uppercase; color:var(--mid); }
.art-share-btns { display:flex; gap:.5rem; flex-wrap:wrap; }
.share-btn {
  display:inline-flex; align-items:center; gap:.5rem;
  padding: .6rem 1rem;
  border: 1px solid var(--ink);
  background: var(--paper);
  color: var(--ink);
  font-family:'IBM Plex Mono',monospace; font-size:var(--fs-tiny);
  letter-spacing:.18em; text-transform:uppercase;
  cursor: pointer; text-decoration: none;
  transition: background .2s, color .2s;
}
.share-btn:hover { background: var(--ink); color: var(--paper); }
.share-btn.copied { background: var(--blue); color: var(--paper); border-color: var(--blue); }

/* ===== RELATED ===== */
.art-related {
  background: var(--paper-warm);
  padding: 4rem var(--pad-x);
  border-top: 1px solid rgba(0,0,0,.08);
}
.art-related-inner { max-width: 1100px; margin: 0 auto; }
.art-related-eyebrow { font-size:var(--fs-micro); letter-spacing:.3em; color:var(--blue); text-transform:uppercase; margin-bottom:.5rem; display:flex; align-items:center; gap:10px; }
.art-related-eyebrow::before { content:''; display:block; width:8px; height:8px; background:var(--blue); }
.art-related-title { font-family:'IBM Plex Sans Condensed',sans-serif; font-size:2rem; font-weight:700; letter-spacing:-1px; text-transform:uppercase; margin-bottom:2rem; }
.art-related-grid { display:grid; grid-template-columns:1fr; gap:1.5rem; }
@media (min-width: 768px) { .art-related-grid { grid-template-columns:repeat(3, 1fr); } }
.rel-card { display:flex; flex-direction:column; gap:.6rem; cursor:pointer; text-decoration:none; color:inherit; transition:transform .25s; }
.rel-card:hover { transform:translateY(-3px); }
.rel-card-cover { aspect-ratio:4/3; min-height:140px; background:var(--blue); position:relative; overflow:hidden; }
.rel-card-cover.has-cover { background-color:var(--mid-soft); background-size:cover; background-position:center; }
.rel-card-cover.ac-v0::before, .rel-card-cover.ac-v1::before, .rel-card-cover.ac-v2::before { content:''; position:absolute; inset:0; pointer-events:none; }
.rel-card-cover.ac-v0::before { background:radial-gradient(circle, rgba(242,241,237,.88) 1.5px, transparent 2px) 0 0 / 8px 8px; -webkit-mask-image:linear-gradient(135deg, transparent 15%, black 75%); mask-image:linear-gradient(135deg, transparent 15%, black 75%); }
.rel-card-cover.ac-v1 { background:var(--ink); }
.rel-card-cover.ac-v2 { background:var(--red); }
.rel-card-tag { position:absolute; top:.6rem; left:.6rem; font-size:var(--fs-micro); letter-spacing:.2em; color:var(--paper); text-transform:uppercase; background:var(--ink); padding:3px 7px; z-index:1; }
.rel-card-title { font-family:'IBM Plex Sans Condensed',sans-serif; font-size:1.15rem; font-weight:700; line-height:1.1; letter-spacing:-.3px; text-transform:uppercase; transition:color .2s; }
.rel-card:hover .rel-card-title { color:var(--blue); }
.rel-card-meta { font-size:var(--fs-micro); letter-spacing:.2em; color:var(--mid); text-transform:uppercase; }

/* ===== BACK LINK ===== */
.art-back {
  display:inline-flex; align-items:center; gap:.6rem;
  margin: 0 auto 2rem;
  padding: .8rem 1.2rem;
  border: 1px solid var(--ink);
  background: transparent;
  color: var(--ink);
  font-family:'IBM Plex Mono',monospace; font-size:var(--fs-tiny);
  letter-spacing:.18em; text-transform:uppercase;
  text-decoration: none;
  transition: background .2s, color .2s;
}
.art-back:hover { background: var(--ink); color: var(--paper); }

/* ===== FOOTER ===== */
footer { background:var(--ink); color:var(--paper); border-top:1px solid rgba(242,241,237,.15); padding:3rem var(--pad-x) 2rem; padding-bottom:max(2rem, env(safe-area-inset-bottom)); }
.foot-top { display:grid; grid-template-columns:1fr; gap:2rem; margin-bottom:3rem; max-width:1200px; margin-left:auto; margin-right:auto; }
@media (min-width: 768px) { .foot-top { grid-template-columns:2fr 1fr 1fr 1fr; } }
.foot-brand { font-family:'IBM Plex Sans Condensed',sans-serif; font-size:3rem; font-weight:700; text-transform:uppercase; line-height:.9; letter-spacing:-1.5px; }
.foot-brand span { color:var(--blue); }
.foot-brand-sub { font-family:'IBM Plex Mono',monospace; font-size:.7rem; letter-spacing:3px; color:rgba(242,241,237,.5); text-transform:uppercase; margin-top:.5rem; }
.foot-col h4 { font-size:var(--fs-micro); letter-spacing:.25em; color:var(--blue); text-transform:uppercase; margin-bottom:1rem; font-weight:600; }
.foot-col ul { list-style:none; display:flex; flex-direction:column; gap:.5rem; }
.foot-col a { font-size:.78rem; color:rgba(242,241,237,.7); text-decoration:none; letter-spacing:1px; transition:color .2s; }
.foot-col a:hover { color:var(--blue); }
.foot-bottom { padding-top:1.5rem; border-top:1px solid rgba(242,241,237,.15); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1rem; font-size:var(--fs-micro); letter-spacing:.2em; color:rgba(242,241,237,.4); text-transform:uppercase; max-width:1200px; margin-left:auto; margin-right:auto; }
</style>
</head>
<body>

<nav>
  <a href="/" class="nav-logo">CoolDown<span>·</span>F1</a>
  <ul class="nav-links">
    <li><a href="/">Hero</a></li>
    <li><a href="/articoli.html" class="is-current">Articoli</a></li>
    <li><a href="/#ig">Feed</a></li>
    <li><a href="/calendario.html">Calendario</a></li>
    <li><a href="/classifica.html">Classifica</a></li>
    <li><a href="/#newsletter">Newsletter</a></li>
  </ul>
  <button class="nav-toggle" id="navToggle" aria-label="Menu"><span></span><span></span><span></span></button>
</nav>
<div class="nav-drawer" id="navDrawer">
  <a href="/">Hero</a>
  <a href="/articoli.html">Articoli</a>
  <a href="/#ig">Feed</a>
  <a href="/calendario.html">Calendario</a>
  <a href="/classifica.html">Classifica</a>
  <a href="/#newsletter">Newsletter</a>
</div>

<section class="art-hero">
  <div class="art-hero-inner">
    <div class="crumb">
      <a href="/">Home</a><span class="sep">/</span>
      <a href="/articoli.html">Articoli</a><span class="sep">/</span>
      <span class="current">${escapeHTML(a.tag || '')}</span>
    </div>
    <span class="art-tag">${escapeHTML(a.tag || '—')}</span>
    <h1 class="art-title">${escapeHTML(a.title)}</h1>
    <div class="art-meta-row">
      <span>${formatDate(a.date)}</span>
      <span class="dot"></span>
      <span>${escapeHTML(a.read || '5 min lettura')}</span>
      <span class="dot"></span>
      <span>CoolDown F1</span>
    </div>
  </div>
</section>

<div class="art-cover-wrap">
  <div class="art-cover ${hasCover ? 'has-cover' : variant}"${hasCover ? ` style="background-image:url('${escapeAttr(a.cover)}')"` : ''}></div>
</div>

<section class="art-body-wrap">
  <div class="art-body">
    ${a.excerpt ? `<p class="art-excerpt">${escapeHTML(a.excerpt)}</p>` : ''}
    <article>
${markdownToHTML(a.body)}
    </article>

    <div class="art-share">
      <span class="art-share-lbl">// Condividi</span>
      <div class="art-share-btns">
        <a class="share-btn" href="https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(a.title)}" target="_blank" rel="noopener">Twitter</a>
        <a class="share-btn" href="https://wa.me/?text=${encodeURIComponent(a.title + ' — ' + url)}" target="_blank" rel="noopener">WhatsApp</a>
        <a class="share-btn" href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}" target="_blank" rel="noopener">LinkedIn</a>
        <button class="share-btn" id="copyBtn" type="button">Copia link</button>
      </div>
    </div>

    <div style="text-align:center; margin-top: 3rem;">
      <a class="art-back" href="/articoli.html">← Torna a tutti gli articoli</a>
    </div>
  </div>
</section>

${related.length ? `
<section class="art-related">
  <div class="art-related-inner">
    <div class="art-related-eyebrow">// Continua a leggere</div>
    <h2 class="art-related-title">Altri da <em style="font-family:'IBM Plex Serif',serif;font-style:italic;font-weight:400;color:var(--blue);">${escapeHTML(a.tag || '')}</em></h2>
    <div class="art-related-grid">
      ${related.map(r => {
        const rVariant = ['ac-v0','ac-v1','ac-v2'].includes(r.variant) ? r.variant : 'ac-v0';
        const rCover = r.cover
          ? `<div class="rel-card-cover has-cover" style="background-image:url('${escapeAttr(r.cover)}')"><span class="rel-card-tag">${escapeHTML(r.tag || '')}</span></div>`
          : `<div class="rel-card-cover ${rVariant}"><span class="rel-card-tag">${escapeHTML(r.tag || '')}</span></div>`;
        return `<a class="rel-card" href="/${OUTPUT_DIR}/${r.slug}.html">
          ${rCover}
          <h3 class="rel-card-title">${escapeHTML(r.title)}</h3>
          <div class="rel-card-meta">${formatDate(r.date)} · ${escapeHTML(r.read || '')}</div>
        </a>`;
      }).join('')}
    </div>
  </div>
</section>
` : ''}

<footer>
  <div class="foot-top">
    <div>
      <div class="foot-brand">Cool<span>Down</span></div>
      <div class="foot-brand-sub">Italian F1 Magazine · est. 2025</div>
    </div>
    <div class="foot-col">
      <h4>// Sezioni</h4>
      <ul>
        <li><a href="/articoli.html">Articoli</a></li>
        <li><a href="/calendario.html">Calendario</a></li>
        <li><a href="/classifica.html">Classifica</a></li>
        <li><a href="/#ig">Feed</a></li>
      </ul>
    </div>
    <div class="foot-col">
      <h4>// Social</h4>
      <ul>
        <li><a href="#" target="_blank">Instagram</a></li>
        <li><a href="#" target="_blank">TikTok</a></li>
        <li><a href="#" target="_blank">X / Twitter</a></li>
        <li><a href="#" target="_blank">YouTube</a></li>
      </ul>
    </div>
    <div class="foot-col">
      <h4>// Info</h4>
      <ul>
        <li><a href="#">Chi siamo</a></li>
        <li><a href="#">Contatti</a></li>
        <li><a href="#">Privacy</a></li>
        <li><a href="#">Termini</a></li>
      </ul>
    </div>
  </div>
  <div class="foot-bottom">
    <span>© 2026 CoolDown · Tutti i diritti riservati</span>
    <span>Dati: Jolpica-F1 · OpenF1</span>
  </div>
</footer>

<script>
// Mobile nav
(function(){
  var btn = document.getElementById('navToggle');
  var drawer = document.getElementById('navDrawer');
  if (btn) btn.addEventListener('click', function(){ drawer.classList.toggle('open'); });
})();

// Copy link
(function(){
  var btn = document.getElementById('copyBtn');
  if (!btn) return;
  btn.addEventListener('click', function(){
    navigator.clipboard.writeText(window.location.href).then(function(){
      btn.classList.add('copied');
      btn.textContent = '✓ Copiato';
      setTimeout(function(){
        btn.classList.remove('copied');
        btn.textContent = 'Copia link';
      }, 2000);
    });
  });
})();
</script>
</body>
</html>
`;
}

// ============================================================
// SITEMAP & ROBOTS
// ============================================================
function renderSitemap(articles) {
  const staticPages = [
    { loc: SITE_URL + '/', priority: '1.0', changefreq: 'daily' },
    { loc: SITE_URL + '/articoli.html', priority: '0.9', changefreq: 'daily' },
    { loc: SITE_URL + '/calendario.html', priority: '0.8', changefreq: 'weekly' },
    { loc: SITE_URL + '/classifica.html', priority: '0.8', changefreq: 'weekly' },
  ];
  const articlePages = articles.map(a => ({
    loc: `${SITE_URL}/${OUTPUT_DIR}/${a.slug}.html`,
    priority: '0.7',
    changefreq: 'monthly',
    lastmod: a.date
  }));
  const all = [...staticPages, ...articlePages];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${all.map(p => `  <url>
    <loc>${p.loc}</loc>${p.lastmod ? `\n    <lastmod>${p.lastmod}</lastmod>` : ''}
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;
}

function renderRobots() {
  return `User-agent: *
Allow: /
Disallow: /admin/

Sitemap: ${SITE_URL}/sitemap.xml
`;
}

// ============================================================
// MAIN
// ============================================================
function main() {
  console.log('[build] CoolDown F1 — generazione pagine articoli...');
  console.log(`[build] SITE_URL = ${SITE_URL}`);

  const articles = readArticles();
  console.log(`[build] Trovati ${articles.length} articoli`);

  if (articles.length > 0) {
    // Crea directory output
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    // Genera pagina per ogni articolo
    for (const a of articles) {
      const html = renderArticlePage(a, articles);
      const outPath = path.join(OUTPUT_DIR, `${a.slug}.html`);
      fs.writeFileSync(outPath, html, 'utf-8');
      console.log(`[build] ✓ ${outPath}`);
    }
  }

  // Genera sitemap (anche se 0 articoli, ha le 4 pagine statiche)
  fs.writeFileSync('sitemap.xml', renderSitemap(articles), 'utf-8');
  console.log('[build] ✓ sitemap.xml');

  // Genera robots.txt
  fs.writeFileSync('robots.txt', renderRobots(), 'utf-8');
  console.log('[build] ✓ robots.txt');

  console.log('[build] Completato.');
}

main();
