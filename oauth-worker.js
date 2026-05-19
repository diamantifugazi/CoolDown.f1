/**
 * Decap CMS OAuth Proxy for Cloudflare Workers
 * ===============================================
 * Permette a Decap CMS di autenticare gli utenti via GitHub OAuth.
 * Replica la funzionalità di Netlify Identity, ma su Cloudflare.
 *
 * REQUIRED ENVIRONMENT VARIABLES (set in Cloudflare Worker settings):
 *   GITHUB_CLIENT_ID     — Da GitHub OAuth App settings
 *   GITHUB_CLIENT_SECRET — Da GitHub OAuth App settings (mai pubblicare in chiaro!)
 *
 * Endpoint:
 *   GET /auth     → redirige a GitHub per autorizzazione
 *   GET /callback → riceve il code da GitHub, lo scambia per un token, lo invia a Decap
 */

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS headers per chiamate cross-origin da Decap
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // ---- /auth ----
    // Decap chiama questo endpoint per iniziare il flow OAuth.
    // Redirigiamo l'utente a GitHub per autorizzazione.
    if (url.pathname === '/auth') {
      const params = new URLSearchParams({
        client_id: env.GITHUB_CLIENT_ID,
        redirect_uri: `${url.origin}/callback`,
        scope: 'repo,user',
        state: crypto.randomUUID(),
      });
      return Response.redirect(`${GITHUB_AUTHORIZE_URL}?${params.toString()}`, 302);
    }

    // ---- /callback ----
    // GitHub redirige qui dopo l'autorizzazione con un code temporaneo.
    // Scambiamo il code per un access token, poi inviamo il token a Decap
    // via postMessage (Decap apre /auth in un popup e ascolta i messaggi).
    if (url.pathname === '/callback') {
      const code = url.searchParams.get('code');
      if (!code) {
        return new Response('Missing code parameter', { status: 400, headers: corsHeaders });
      }

      try {
        const tokenResponse = await fetch(GITHUB_TOKEN_URL, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: env.GITHUB_CLIENT_ID,
            client_secret: env.GITHUB_CLIENT_SECRET,
            code: code,
          }),
        });

        const data = await tokenResponse.json();

        if (data.error) {
          return new Response(`OAuth error: ${data.error_description || data.error}`, {
            status: 400,
            headers: corsHeaders,
          });
        }

        const token = data.access_token;

        // Risposta HTML che invia il token al CMS aperto in una finestra parent
        const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <title>Login completato</title>
  <style>
    body {
      font-family: system-ui, sans-serif;
      background: #0033FF;
      color: #F2F1ED;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      min-height: 100vh;
      margin: 0;
      text-align: center;
      padding: 2rem;
    }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    p { opacity: 0.7; font-size: 0.9rem; }
  </style>
</head>
<body>
  <h1>✓ Login completato</h1>
  <p>Questa finestra si chiuderà automaticamente.</p>
  <script>
    (function() {
      function sendMessage(status, content) {
        const message = 'authorization:github:' + status + ':' + JSON.stringify(content);
        window.opener.postMessage(message, '*');
      }
      window.addEventListener('message', function(e) {
        if (e.data === 'authorizing:github') {
          sendMessage('success', { token: ${JSON.stringify(token)}, provider: 'github' });
          setTimeout(function() { window.close(); }, 800);
        }
      }, false);
      // Trigger iniziale: alcuni client non mandano "authorizing:github" subito
      window.opener.postMessage('authorizing:github', '*');
      // Fallback: chiusura automatica dopo 5s
      setTimeout(function() {
        sendMessage('success', { token: ${JSON.stringify(token)}, provider: 'github' });
        setTimeout(function() { window.close(); }, 800);
      }, 1500);
    })();
  </script>
</body>
</html>`;
        return new Response(html, {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            ...corsHeaders,
          },
        });
      } catch (error) {
        return new Response(`Error: ${error.message}`, { status: 500, headers: corsHeaders });
      }
    }

    // ---- / (health check) ----
    if (url.pathname === '/' || url.pathname === '') {
      return new Response('CoolDown F1 OAuth Proxy · OK', {
        headers: { 'Content-Type': 'text/plain', ...corsHeaders },
      });
    }

    return new Response('Not found', { status: 404, headers: corsHeaders });
  },
};
