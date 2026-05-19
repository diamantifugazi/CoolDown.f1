# CoolDown · F1

Sito editoriale F1 con CMS integrato. HTML/CSS/JS puro, build statico via Node.
Hosting su **Cloudflare Pages**, contenuti via **Decap CMS** con auth GitHub OAuth.

---

## 📁 Struttura del progetto

```
cooldown-f1/
├── index.html              ← Home (hero, articoli, feed, calendario, classifica, newsletter)
├── articoli.html           ← Pagina articoli (filtri + caroselli per categoria)
├── calendario.html         ← Calendario stagione completo
├── classifica.html         ← Classifica + statistiche stagione
├── build.js                ← Script che genera le pagine articolo SEO (gira al deploy)
├── admin/
│   ├── index.html          ← Loader Decap CMS
│   └── config.yml          ← Configurazione del CMS
├── content/articles/       ← Articoli markdown (gestiti dal CMS — NON toccare a mano)
├── images/uploads/         ← Cover images caricate dal CMS
├── oauth-worker.js         ← Cloudflare Worker per OAuth GitHub (deployare separatamente)
├── _headers                ← Cache headers per Cloudflare Pages
├── robots.txt              ← Generato da build.js
├── sitemap.xml             ← Generato da build.js
└── articoli/               ← Pagine articolo generate da build.js (auto)
```

---

## 🚀 Setup completo (prima installazione)

### 1. Repo GitHub
File già caricati su `diamantifugazi/CoolDown.f1`.

### 2. Cloudflare Pages — hosting del sito

1. Vai su **dash.cloudflare.com** → login
2. Sidebar: **Workers & Pages** → **Create application** → tab **Pages** → **Connect to Git**
3. Autorizza Cloudflare per GitHub → seleziona repo `CoolDown.f1`
4. **Build settings** (importante!):
   - **Project name**: `cooldown-f1`
   - **Production branch**: `main`
   - **Framework preset**: None
   - **Build command**: `node build.js`
   - **Build output directory**: `/`
5. **Environment variables** (in basso, prima di deployare):
   - `SITE_URL` = `https://cooldown-f1.pages.dev` (o dominio custom)
6. Click **Save and Deploy**

Primo build dura 1-2 min. Quando finisce: sito online su `cooldown-f1.pages.dev`.

**Cosa fa il build:**
- Legge tutti i `.md` in `content/articles/`
- Genera `articoli/<slug>.html` per ognuno (SEO completo)
- Genera `sitemap.xml` e `robots.txt`
- Cloudflare deploya tutto

### 3. GitHub OAuth App

1. `github.com/settings/developers` → **OAuth Apps** → **New OAuth App**
2. Compila:
   - **Application name**: `CoolDown F1 Admin`
   - **Homepage URL**: `https://cooldown-f1.pages.dev`
   - **Authorization callback URL**: `https://cooldown-f1-oauth.TUO-SUBDOMAIN.workers.dev/callback`
3. Register application
4. Copia **Client ID** e clicca **Generate a new client secret** → copia il valore

### 4. Cloudflare Worker

1. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Workers** → **Create Worker**
2. Nome: `cooldown-f1-oauth`
3. **Deploy** template hello world → **Edit code**
4. Sostituisci tutto col contenuto di `oauth-worker.js`
5. **Save and Deploy**
6. **Settings** → **Variables and Secrets** → aggiungi 2 secret:
   - `GITHUB_CLIENT_ID` (dal passo 3)
   - `GITHUB_CLIENT_SECRET` (dal passo 3)
7. Re-deploy

Test: apri `https://cooldown-f1-oauth.TUO-SUBDOMAIN.workers.dev/` → vedi "CoolDown F1 OAuth Proxy · OK".

### 5. Aggiorna i 3 punti con URL Worker

a) **GitHub OAuth App** (passo 3) — aggiorna Authorization callback URL con valore reale.

b) **`admin/config.yml`** riga 9, sostituisci `YOUR-SUBDOMAIN`:
```yaml
base_url: https://cooldown-f1-oauth.tuosubdomain.workers.dev
```

c) Commit → Cloudflare auto-deploya in 1 min.

### 6. Test del CMS

1. `https://cooldown-f1.pages.dev/admin/`
2. **Login with GitHub** → autorizza → entri nel CMS
3. **Articoli** → **New Articoli** → riempi → **Save**
4. Status: **Draft** → **In Review** → **Publish now**
5. Cloudflare ricostruisce in ~1 min → articolo live su `/articoli/<slug>.html`

---

## ✍️ Workflow editoriale

### Collaboratori
1. `cooldown-f1.pages.dev/admin/` → login GitHub
2. **Articoli** → **New Articoli** → compila → **Save**
3. Status → **In Review** → avvisa admin

### Admin
1. Tab **Workflow** → apri articolo in **In Review**
2. Modifica se serve → Status **Ready** → **Publish now**
3. Cloudflare ricostruisce → live in ~30-60s

### Aggiungere collaboratori
1. `github.com/diamantifugazi/CoolDown.f1/settings/access` → **Add people**
2. Username GitHub → **Triage** o **Write** access
3. Lui accetta invito email → accede al CMS

Collaboratori DEVONO avere un account GitHub.

---

## 📰 Cosa succede quando pubblichi un articolo

Esempio: "Perché Ferrari ha cambiato passo a Imola"

1. Decap scrive `content/articles/2026-05-12-perche-ferrari-ha-cambiato-passo-a-imola.md` su GitHub
2. Cloudflare riceve commit → triggera build
3. `node build.js` gira:
   - Slug → `perche-ferrari-ha-cambiato-passo-a-imola`
   - Genera `articoli/perche-ferrari-ha-cambiato-passo-a-imola.html` con:
     - Layout brutalist editorial
     - SEO completo: title, description, canonical, Open Graph, Twitter Card
     - JSON-LD Schema.org per rich snippets Google
     - Articoli correlati (3 della stessa categoria)
     - Bottoni share (Twitter, WhatsApp, LinkedIn, copia link)
     - Breadcrumb e "Torna agli articoli"
   - Aggiorna `sitemap.xml`
4. Cloudflare deploya
5. URL: `https://cooldown-f1.pages.dev/articoli/perche-ferrari-ha-cambiato-passo-a-imola.html`
6. Google indicizza in 1-7 giorni
7. Quando condividi su social: preview ricca (titolo + descrizione + cover)

---

## 🎨 Cover images

- **Formato**: JPG o WebP
- **Dimensioni**: 1200-1600px larghezza, ratio 16:9 o 16:10
- **Peso**: max 400 KB

Senza cover → stile halftone astratto (3 varianti: blu/nero/rosso).

---

## 🔧 Personalizzazione

### Aggiungere categoria
- Edita `admin/config.yml` → `fields → tag → options`
- Aggiungi anche in `view_filters` per filtro CMS
- Commit → subito disponibile

### Cambiare colori brand
- Cerca `:root` in ogni HTML
- Modifica `--blue`, `--paper`, `--ink`

### Disabilitare articoli fallback
Quando hai 10+ articoli reali:
- `index.html` e `articoli.html` → trova `const FALLBACK_ARTICLES = [`
- Sostituisci tutto con `const FALLBACK_ARTICLES = [];`

---

## ⚠️ Note importanti

### Approvazione obbligatoria
Decap con backend GitHub direct NON blocca tecnicamente i collaboratori dal pubblicare. È una **convenzione del team**. Per restringere:
- Accesso "Triage" invece di "Write"
- **Branch protection** su `main`: richiedi PR review prima di merge
- Ogni Publish diventa un PR che TU approvi su GitHub

### Articoli fallback e SEO
I 14 fallback in `index.html`/`articoli.html` NON vengono mai indicizzati. Sono placeholder visivi quando il CMS è vuoto. `build.js` non li tocca.

### Performance
- HTML statico ovunque → caricamento istantaneo
- Cache headers su `_headers` (immagini 1 anno)
- Articoli generati al build, non runtime → zero JS per leggerli
- Dati F1 fetchati lato client: Jolpica, OpenF1, Open-Meteo

---

## 🆘 Troubleshooting

**Build su Cloudflare fallisce con "node: not found"**
→ Settings → Functions → Compatibility Date: assicurati data 2024+.

**Articoli pubblicati non appaiono in /articoli/<slug>.html**
→ Verifica `build.js` eseguito (tab Deployments). Se "0 articles found", il `.md` non è in `content/articles/`.

**`/admin/` mostra pagina bianca**
→ DevTools (F12) → Console. Probabili cause: `base_url` sbagliato, Worker non risponde.

**"Login with GitHub" non funziona**
→ Apri `https://tuo-worker.workers.dev/` — deve dire "OK". Se 404, Worker non deployato. Se "Missing env var", controlla Secret.

**Login OK ma non vedo articoli nel CMS**
→ Branch sbagliato in `config.yml` (`main` vs `master`).

**Pagine articolo hanno URL sbagliata**
→ Imposta variabile `SITE_URL` su Cloudflare Pages (Settings → Environment Variables) col dominio corretto.

---

## 📊 Costi & limiti (tutto gratis)

| Servizio | Piano | Limiti |
|---|---|---|
| Cloudflare Pages | Free | 500 deploy/mese, bandwidth illimitato, build illimitato |
| Cloudflare Workers | Free | 100.000 richieste/giorno (l'OAuth ne usa <100/giorno) |
| GitHub | Free | Repo public illimitati |
| Decap CMS | Open source | Nessun limite |

---

© 2026 CoolDown — Italian F1 Magazine
