# Production Deployment

This app is a **TanStack Start** project. In production it runs as a **Node.js HTTP server** (SSR + API), optionally behind **Nginx** for TLS and behind **Tor** for an onion service. It is NOT a static site — there is no `index.html`; HTML is server-rendered per request.

- Runtime: Node.js 20 LTS (or 22 LTS)
- Build output: `.output/server/index.mjs` (standalone Node server) + `.output/public/` (static assets, served by the same Node process)
- Start command: `node .output/server/index.mjs` (or `npm start`)
- Recommended topology: **Nginx (TLS, gzip, caching) → PM2 → Node (127.0.0.1:3000)**. Tor hidden service points at the same Node port (or at Nginx on `127.0.0.1:80`).
- Concurrency: real Node HTTP server, handles many concurrent users. `vite preview` is for local previews only — do NOT use it in production.

---

## 1. One-time VPS setup (Ubuntu 22.04 / 24.04 / Debian 12)

```bash
sudo apt update && sudo apt install -y curl git nginx tor ufw

# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PM2 process manager
sudo npm install -g pm2

# Firewall
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

## 2. Clone & build

```bash
sudo mkdir -p /var/www && sudo chown -R $USER:$USER /var/www
cd /var/www
git clone <YOUR_REPO_URL> ftescrow
cd ftescrow

npm ci          # or: npm install
npm run build   # produces .output/
```

## 3. Configure environment

```bash
cp .env.production.example .env
nano .env       # fill in real values
chmod 600 .env
```

Required variables (see `.env.production.example`):

| Var | Where used |
|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` | client bundle (must be set at **build** time) |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | server fns (auth middleware) |
| `SUPABASE_SERVICE_ROLE_KEY` | server admin operations (RLS bypass) |
| `ADMIN_PASSWORD` | admin login |
| `ADMIN_SESSION_SECRET` | admin cookie encryption — must be ≥32 chars. `openssl rand -hex 32` |
| `HOST`, `PORT`, `NODE_ENV` | Node server bind |

> If you change any `VITE_*` value, you must `npm run build` again — they are inlined at build time.

## 4. Start with PM2

```bash
cd /var/www/ftescrow
mkdir -p logs
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd -u $USER --hp $HOME    # follow the printed sudo command
```

Useful PM2 commands:

```bash
pm2 status
pm2 logs ftescrow
pm2 restart ftescrow
pm2 reload ftescrow      # zero-downtime
```

Deploy updates:

```bash
cd /var/www/ftescrow
git pull
npm ci
npm run build
pm2 reload ftescrow
```

## 5. Nginx reverse proxy (clearnet domain + TLS)

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
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
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

Enable + TLS:

```bash
sudo ln -s /etc/nginx/sites-available/ftescrow /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

## 6. Tor hidden service (onion)

Edit `/etc/tor/torrc`:

```
HiddenServiceDir /var/lib/tor/ftescrow/
HiddenServicePort 80 127.0.0.1:3000
```

Then:

```bash
sudo systemctl restart tor
sudo cat /var/lib/tor/ftescrow/hostname    # your .onion address
```

Add the onion host to `vite.config.ts` → `vite.server.allowedHosts` (already done for the current onion), then rebuild + reload PM2.

For privacy, point the onion at the Node port directly (as above) rather than through Nginx — avoids leaking the clearnet vhost.

## 7. Verifying production

```bash
curl -I http://127.0.0.1:3000/        # 200 from Node
curl -I https://yourdomain.com/       # 200 via Nginx
pm2 logs ftescrow --lines 100         # no startup errors
```

## 8. Troubleshooting

- **`Unauthorized` / blank admin** → `ADMIN_SESSION_SECRET` < 32 chars, or different secret between restarts.
- **Supabase env errors at runtime** → missing `SUPABASE_*` (server-only) vars in `.env`. `VITE_*` alone isn't enough on the server.
- **Static assets 404** → Nginx not forwarding `/_build/` to Node, or build was not run after `git pull`.
- **Onion shows "blocked host"** → add it to `vite.config.ts` `allowedHosts` and rebuild.
- **High memory** → tune `max_memory_restart` in `ecosystem.config.cjs`, or scale with `instances: "max", exec_mode: "cluster"`.
