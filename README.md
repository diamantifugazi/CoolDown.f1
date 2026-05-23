# CoolDown F1

Italian F1 magazine — editorial brutalist on blue.

**Live**: https://cooldown-f1.pages.dev
**Repo**: https://github.com/diamantifugazi/CoolDown.f1
**CMS**: https://cooldown-f1.pages.dev/admin/

---

## Architettura

- **Frontend**: HTML/CSS/JS vanilla, no framework
- **Hosting**: Cloudflare Pages (auto-deploy on push to `main`)
- **CMS**: Decap CMS v3 with GitHub OAuth via Cloudflare Worker
- **Build**: `node build.js` genera `/articoli/<slug>.html`, `sitemap.xml`, `robots.txt` da `content/articles/*.md`
- **Data sources**: Jolpica F1 API, OpenF1 API, Open-Meteo

---

## File principali

| File | Scopo |
|---|---|
| `index.html` | Home: hero+countdown+meteo, articoli featured 1+4, feed split IG/TikTok, calendario mini, classifica top 11 + mini stats |
| `articoli.html` | Caroselli per categoria |
| `calendario.html` | Calendario completo stagione |
| `classifica.html` | Classifica piloti + costruttori |
| `feed.html` | Carosello Instagram + carosello TikTok (placeholder) |
| `statistiche.html` | 10 statistiche con animazione scroll-driven |
| `admin/index.html` | Loader Decap CMS |
| `admin/config.yml` | Configurazione CMS |
| `oauth-worker.js` | Cloudflare Worker per OAuth GitHub |
| `build.js` | Build script |
| `_headers` | Cache headers Cloudflare |

---

## Deploy

Auto-deploy a ogni push su `main`. Cloudflare Pages esegue `node build.js` con env `SITE_URL=https://cooldown-f1.pages.dev`.

## Modifiche manuali permesse

✅ Tutti gli HTML, `build.js`, `admin/config.yml`
❌ NON modificare a mano `content/articles/*.md` (usa CMS), `articoli/*.html` o `sitemap.xml`/`robots.txt` (auto-generati)

---

## Modifiche maggio 2026

- Logo "Cool**Down**" compatto, link Stats/Feed aggiunti, Idle rimosso
- Session badge 3 stati (idle/soon/live) nel countdown
- Filtri articoli rimossi (caroselli per categoria sufficienti)
- Immagini body `![alt](url "didascalia")` → figure centrata
- Cover full-bleed 21:9 desktop / 16:9 mobile
- Dal feed: 4 IG + 2 TikTok, bottoni separati
- 4 mini stats sotto Mondiale
- Nuova pagina Feed (caroselli)
- Nuova pagina Statistiche (scroll-driven animation)
- Classifica: stats spostate altrove
