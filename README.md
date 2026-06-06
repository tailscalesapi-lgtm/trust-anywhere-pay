# ftescrow — Production Deployment (Linux / Debian / Kali)

This is a **TanStack Start** app (React 19 + Vite 7). In production it runs as a
**single Node.js HTTP server** that does SSR + serves the built static assets +
exposes the server functions / API routes — no Vite dev server, no separate
static host.

- Build output: `.output/server/index.mjs` (standalone Node bundle, Nitro
  `node-server` preset) plus `.output/public/` (assets, served by the same
  Node process).
- Production entry: **`server.js`** — loads `.env`, sets safe defaults
  (`PORT=8080`, `HOST=0.0.0.0`, `NODE_ENV=production`) and boots the built
  server.
- Start command: `npm start` → `node server.js`
- Listens on: `process.env.PORT || 8080`, bound to `0.0.0.0` (so Nginx /
  Tor / Docker / a remote LAN can all reach it).

## Workflow

```bash
npm install
npm run build
npm start            # serves on http://0.0.0.0:8080
```

That's it — no other process, no dev dependencies needed at runtime.

---

## 1. One-time VPS setup (Debian 12 / Ubuntu 22.04+ / Kali)

```bash
sudo apt update && sudo apt install -y curl git nginx tor ufw

# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PM2 (process manager — keeps the app alive across reboots)
sudo npm install -g pm2

# Firewall (open SSH + HTTP/HTTPS; keep 8080 closed externally — Nginx proxies it)
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

## 2. Clone, install, build

```bash
sudo mkdir -p /var/www && sudo chown -R $USER:$USER /var/www
cd /var/www
git clone <YOUR_REPO_URL> ftescrow
cd ftescrow

npm ci
npm run build        # produces .output/
```

## 3. Configure environment

```bash
cp .env.production.example .env
nano .env            # fill in real values
chmod 600 .env
```

Required variables:

| Var | Where used |
|---|---|
| `PORT`, `HOST`, `NODE_ENV` | Node server bind (defaults: `8080`, `0.0.0.0`, `production`) |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` | client bundle — **must be set at build time**; rebuild after changing |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | server fns (auth middleware) |
| `SUPABASE_SERVICE_ROLE_KEY` | server admin operations (RLS bypass) |
| `ADMIN_PASSWORD` | admin panel login |
| `ADMIN_SESSION_SECRET` | admin cookie encryption — **≥32 chars**, generate with `openssl rand -hex 32` |

## 4. Run with PM2

```bash
cd /var/www/ftescrow
mkdir -p logs
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd -u $USER --hp $HOME    # run the printed sudo command
```

Useful:

```bash
pm2 status
pm2 logs ftescrow
pm2 restart ftescrow --update-env   # after editing .env
pm2 reload ftescrow                 # zero-downtime
```

Updating after a code change:

```bash
cd /var/www/ftescrow
git pull
npm ci
npm run build
pm2 reload ftescrow
```

## 5. Nginx reverse proxy → `localhost:8080`

`/etc/nginx/sites-available/ftescrow`:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    client_max_body_size 25m;
    gzip on;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;

    # Long-cache hashed static assets
    location /_build/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade           $http_upgrade;
        proxy_set_header Connection        "upgrade";
        proxy_read_timeout 60s;
    }
}
```

Enable + issue TLS:

```bash
sudo ln -s /etc/nginx/sites-available/ftescrow /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

## 6. Tor hidden service (`.onion`)

A hidden service is just Tor forwarding an onion address to a local TCP
port. Point it at the Node server directly (port 8080) — **not** through
Nginx — so the clearnet vhost / TLS cert never leak into the onion
response.

Edit `/etc/tor/torrc`:

```
HiddenServiceDir /var/lib/tor/ftescrow/
HiddenServicePort 80 127.0.0.1:8080
```

Then:

```bash
sudo systemctl restart tor
sudo cat /var/lib/tor/ftescrow/hostname     # → your <something>.onion
```

Notes:

- The Node server is already bound to `0.0.0.0:8080`, so `127.0.0.1:8080`
  works for Tor without any extra config.
- If you want the onion address recognized by Vite during local dev, add it
  to `vite.config.ts` → `vite.server.allowedHosts`, then rebuild.
- For maximum privacy keep `ufw` blocking 8080 from the public internet —
  only `127.0.0.1` (Nginx and Tor) should hit it.

## 7. Verify

```bash
curl -I http://127.0.0.1:8080/         # 200 OK from Node
curl -I https://yourdomain.com/        # 200 OK via Nginx
pm2 logs ftescrow --lines 100          # no startup errors
```

## 8. Troubleshooting

- **`Build output not found at .output/server/index.mjs`** → run `npm run build` first.
- **`Unauthorized` on admin** → `ADMIN_SESSION_SECRET` shorter than 32 chars, or it changed between restarts.
- **`Missing Supabase environment variable(s)...`** → `SUPABASE_*` server vars missing in `.env`. `VITE_*` alone is not enough on the server.
- **Static assets 404** → forgot to `npm run build` after pulling, or Nginx is not forwarding `/_build/` to Node.
- **Onion shows "blocked host"** → add it to `vite.config.ts` `allowedHosts` and rebuild.
- **Need to change port** → edit `PORT` in `.env`, `pm2 restart ftescrow --update-env`, and update the `proxy_pass` line in the Nginx config.
