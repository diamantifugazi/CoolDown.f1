# CoolDown F1 — Audit codice (23 maggio 2026)

Output del punto 9 del piano. Ordinato per **rischio reale × sforzo per risolvere**, non per quantità di righe toccate. Le cose che fanno male sono in alto.

---

## 🔴 HIGH — Da fare presto

### H1. `og:image` punta a un file inesistente
**File**: `build.js`, riga ~133
**Problema**: gli articoli generati hanno `<meta property="og:image" content=".../images/og-default.png">`. Il file `og-default.png` non esiste nel repo, quindi qualsiasi articolo condiviso su WhatsApp/Instagram/LinkedIn ha l'anteprima rotta quando l'articolo non ha una cover propria.
**Impatto**: shared link senza immagine. SEO/social.
**Fix**: o carichi un'immagine 1200×630 in `/images/og-default.png` (consigliato), oppure cambio il fallback al primo articolo con cover, o a `/images/uploads/ferrari.avif` che esiste già.
**Sforzo**: 5 min (upload immagine via CMS) oppure 1 riga in `build.js`.

### H2. `FALLBACK_ARTICLES` duplicato in due file → drift reale già in corso
**File**: `index.html` (riga ~2611) + `articoli.html` (riga ~487)
**Problema**: l'array di 14 articoli fallback è copiato verbatim in entrambi i file. Tutti e due hanno il commento `⚠️ Se modifichi questi articoli, modifica anche la stessa costante in [altro file]`. Significa che chi l'ha scritto **sapeva già** che è fragile. Se aggiungi/cambi un fallback solo in uno, la home e la lista articoli mostrano fallback diversi.
**Impatto**: bassissimo finché il CMS funziona (i fallback non si vedono quasi mai). Alto se un giorno il CMS è offline e i due file divergono.
**Fix**: estrarre in `assets/fallback-articles.js` e includere via `<script src="...">` nei due file. ~250 righe in meno, una sola fonte di verità.
**Sforzo**: 15 min. Però rompe il principio "single-file HTML" che hai oggi. Decidi tu.

### H3. ⚠ `roundCurrent`/`roundTotal` non sono più visibili da nessuna parte
**File**: tutte le pagine
**Problema**: dopo il punto 4 (rimozione meta subhero/hero), questi due valori vengono calcolati dai JS ma scritti su elementi che non esistono più. Ho messo i `if (el)` difensivi quindi non si rompe nulla, ma è codice che fa fetch, parsing, calcoli e poi getta via il risultato. ~30 righe di JS sostanzialmente morto.
**Impatto**: zero per l'utente finale, ma è codice che gira a vuoto.
**Fix possibili**:
- (a) lasciarlo così — costa nulla, magari un domani lo rimetti
- (b) rimuovere completamente il calcolo dai JS
- (c) ⭐ **suggerisco**: rimettere "Round X / 24" da qualche parte, magari nel countdown card. È un'info utile che ora è sparita.

---

## 🟡 MEDIUM — Quando hai tempo

### M1. CSS+JS duplicato tra le 6 pagine
**File**: tutti gli HTML
**Problema concreto**: nav (~30 righe CSS + ~25 righe markup), footer (~15+30), cursor (~5 CSS + ~50 JS dopo le ultime modifiche), loader, fetchJSON+cache, mobile nav, `TEAM_COLORS`, halftone variants — sono tutti **copia-incollati 6 volte**. Quando vorrai cambiare un colore brand, dovrai farlo in 6 file (7 con `build.js`).

**Numeri approssimativi**:
- `index.html`: 2932 righe → ~600 sono shared con le altre pagine
- ogni subpage: ~400 righe → ~250 sono identiche tra loro

**Fix** (in ordine di invasività):
1. **Minimo**: estrai `assets/shared.css` con nav/footer/loader/cursor/halftone. Linkalo dai 6 HTML + dal template di `build.js`. Risparmi ~150 righe per file.
2. **Medio**: anche `assets/shared.js` con fetchJSON, cache, TEAM_COLORS, cursor logic, mobile nav. Risparmi altri ~80 righe per file.
3. **Massimo**: introdurre un build step (es. esbuild/snowpack/vite) o usare partials con un mini-templater Node nel `build.js`. Riscrittura significativa.

**Raccomandato**: livello 1 e 2. Sono ~2 ore di lavoro e ti danno il 90% del beneficio. Livello 3 lo eviterei finché il sito è di queste dimensioni.

**Sforzo**: 2-4h livello 1+2.

### M2. Nav e footer duplicati nei markup
**File**: tutti gli HTML + `build.js`
**Problema**: ogni volta che riordini un link (come hai fatto oggi con Stats), tocchi 7 file. Già fatto adesso, ma ricapita.
**Fix**: stessa cosa di M1. Se introduci un mini-templater Node nel build, generi tutti gli HTML da un layout + content. Niente più mass-edit a mano. Alternativa più semplice: lasci HTML standalone ma fai un controllo CI/script che verifica che nav e footer siano identici in tutti i file.
**Sforzo**: dipende dall'approccio. Se vai con un build step proper, 4-6h.

### M3. Markdown parser di `build.js` è minimale
**File**: `build.js`, `markdownToHTML()`
**Problema**: gestisce headings (##, ###), bold, italic, link, liste, immagini-figure. **Non gestisce**: code blocks (\`\`\`), blockquote (>), tables, code inline (\`). Se mai vorrai pubblicare un articolo tech con codice o un'analisi citata da blockquote, non funzionerà.
**Fix**: introdurre `marked` o `markdown-it` come dipendenza npm. ~5 righe in `build.js`, e il CMS Decap supporta già queste sintassi.
**Sforzo**: 30 min.

### M4. `bindCursorHover` selettori inconsistenti per pagina
**File**: 6 HTML
**Problema**: ogni pagina ha un set diverso di selettori per il cursor:hover. `feed.html` agganciava `.cal-row` (sbagliato, l'ho corretto). `statistiche.html` aggancia solo `a, button, .cal-row` (ne mancano altri). Risultato: alcuni elementi interattivi non danno il feedback "cursor cresce".
**Fix**: una lista canonica `a, button, [role=button], .feat-card, .carousel-card, .feed-card, .cal-row, .st-row, .tab, .see-all, .stat-box, .ig-post, .carousel-btn, .share-btn, .ig-cta` da usare ovunque. Diventa una funzione condivisa in `shared.js`.
**Sforzo**: 15 min se hai shared.js, altrimenti 6× 2 min.

### M5. Cache `fetchJSON` per GitHub API ora è 1 minuto — ma non c'è rate-limit handling
**File**: `index.html`, `articoli.html`
**Problema**: GitHub API anonima ha limite di 60 richieste/h per IP. Cache 1 minuto significa fino a ~120 richieste/h per utente attivo che naviga tra home e articoli. Non blocca, ma potrebbe rispondere 403 in casi di carico. Non c'è gestione del 403.
**Fix**: in `fetchJSON`, se response status === 403/429 → cache il fallback per 5 min. Robustezza.
**Sforzo**: 10 min.

---

## 🟢 LOW — Pulizia, nice-to-have

### L1. Codice morto CSS dopo le ultime modifiche
- `.hero-meta`, `.hero-meta-r` in `index.html` (~6 righe) — markup rimosso
- `.subhero-meta`, `.subhero-meta-r` in 5 HTML (~3 righe ognuno) — markup rimosso
- `.loader-meta` in `statistiche.html`/`feed.html` se decidi che il testo è inutile — per ora lo usi
- `grid-template-rows: auto 1fr auto auto` nella `.hero` di `index.html` — ora gli elementi figli sono 3, non 4. La quarta `auto` è ignorata ma andrebbe rimossa.
- `@keyframes pulse` in `index.html` definito ma nessuno lo usa (c'è solo `sessionPulse`). Era usato da `.session-dot.soon` che ho rimosso.
- `.cal-row.is-live::before` in `index.html` (homepage mini-calendario) — la home non usa mai la classe `is-live`, solo `calendario.html` lo fa. Codice morto in index.

**Impatto**: ~25 righe CSS che non fanno niente. Performance trascurabile, pulizia sì.
**Sforzo**: 10 min totali.

### L2. 3 setTimeout di sicurezza per il loader nelle subpage
**File**: `articoli.html`, `calendario.html`, `classifica.html`, `feed.html`, `statistiche.html`
**Problema**: ogni pagina ha 3-4 chiamate `setTimeout(hideLoader, ...)` su DOMContentLoaded, load event, e un sentinel a 1200ms. È difensivo, ma ne basterebbero 2 (1 su `load` + 1 sentinel). Tutti questi insieme partono comunque, e ogni `hideLoader` ricontrolla `classList.contains('gone')`.
**Impatto**: nessuno, già funziona. Solo confusione nel codice.
**Sforzo**: 5 min × 5 file.

### L3. `setInterval(updateSessionStatus, 60000)` non pausa con tab nascosta
**File**: `index.html`
**Problema**: ogni 60s parte una fetch a OpenF1 anche se la tab è in background. Mobile su 4G → batteria + dati.
**Fix**: `document.addEventListener('visibilitychange', ...)` per pausare/riprendere.
**Sforzo**: 10 min.

### L4. `Promise.race` timeout non aborta davvero il fetch
**File**: tutti gli HTML
**Problema**: dopo 4s la Promise rejecta ma la fetch continua in background, accumulando connessioni pendenti. Se la rete è lentissima e l'utente naviga molto, può saturare.
**Fix**: usare `AbortController` su browser moderni (tutti tranne file:// iOS, dove già non funziona). Wrapper con fallback al `Promise.race` per il caso file://.
**Impatto**: marginale su rete normale.
**Sforzo**: 20 min.

### L5. `loader` index.html ha 4 layer di "safety net"
**File**: `index.html` JS loader
- `setTimeout(hideLoader, 4000)` — sentinel JS
- CSS `animation: loaderAutohide 3.5s forwards` — sentinel CSS puro
- skip se `prefers-reduced-motion`
- skip se `sessionStorage.cd-loader-v1` già visto

Funziona ed è robusto, ma 4 layer per la stessa cosa è un po' troppo. Si potrebbe semplificare a 2 (sessionStorage skip + un solo sentinel). Cosmetico.
**Sforzo**: 10 min.

### L6. Pattern halftone CSS in `em` solo su `.feed-card` e `.ig-post`
**File**: index/feed
**Problema**: il commento nel codice dice "Pattern halftone in em (scala col zoom)", ma è applicato solo in due punti. Il pattern in `px` è ovunque sopratutto in `.hero::before` e simili. È una scelta voluta o un'incoerenza?
**Impatto**: utenti con zoom alto vedono il pattern fisso in molti punti. Visivamente non grave.
**Sforzo**: dipende — se è scelta lascia stare, se è dimenticanza è 5 min × 5 punti.

### L7. `image_search` non implementato come responsive
**File**: tutti, e CMS cover
**Problema**: le cover degli articoli sono caricate come `background-image: url(...)` a piena risoluzione. Su mobile carichi un'immagine da 1200px+ per visualizzarne 320px. Spreco di banda.
**Fix proper**: passare a `<picture>`/`<img srcset>` con Cloudflare Images. Però richiede ristrutturare le card. Alternativa pragmatica: aggiungere `loading="lazy"` sulle cover non featured (già fatto nelle figure body).
**Impatto**: medio su mobile lento. Misurabile con Lighthouse.
**Sforzo**: 1-2h per la versione proper.

---

## ✅ Cose fatte bene (sintesi positiva)

Non è tutto da rifare, anzi:

- `content-visibility: auto` sulle sezioni della home: rendering deferito di sezioni fuori schermo. Best practice moderna.
- IntersectionObserver + fallback 3s per `.reveal`: pattern corretto.
- Cache localStorage con TTL: ben pensato. Solo il TTL della GitHub API era troppo alto, già corretto.
- `Promise.race` con timeout 4s anziché `AbortController`: workaround corretto per il problema noto iOS file://. C'è anche il commento che lo spiega.
- `prefers-reduced-motion` rispettato in loader, stats animations, e ovunque ha senso. Accessibilità OK.
- `safe-area-inset-*` ovunque per iPhone notch. Mobile-first vero.
- Caratteri preload con `as="style"` + `onload` hack: fa parte delle ottimizzazioni di rendering critica.
- Schema.org JSON-LD su pagine articolo: SEO strutturato corretto.
- `_headers` Cloudflare con cache aggressiva sulle immagini (1 anno immutable) e nessuna cache sugli HTML: configurazione corretta per static site.

---

## Raccomandazione operativa

Se vuoi un ROI massimo con minimo sforzo, fai:

1. **H1** (og:image): 5 minuti → impatto immediato su share social
2. **H3 opzione (c)**: rimetti "Round X di 24" nel countdown → recuperi info, niente codice morto
3. **L1** (codice morto CSS): 10 minuti → pulizia gratuita
4. **M3** (markdown parser): 30 minuti → ti sblocca articoli con codice/quote in futuro

Quando ti capita un pomeriggio libero:

5. **M1** livello 1+2 (shared.css + shared.js): 2-4h → da qui in poi le modifiche editoriali tipo "rimuovi Newsletter" si fanno in 1 minuto invece di 7

Il resto è raffinazione che puoi affrontare quando il sito cresce.
