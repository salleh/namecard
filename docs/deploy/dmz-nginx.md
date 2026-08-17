# DMZ nginx reverse proxy — `namecard.example.com`

> **Ownership.** The DMZ nginx host is managed by the **infra team**; its config
> does not live in this repo. This page (and the baseline
> [`dmz-nginx/namecard.example.com.conf`](./dmz-nginx/namecard.example.com.conf))
> is a **handoff reference** for standing up the public entry point.

## Topology recap

```
[Internet]
   │  HTTPS  (TLS terminates HERE — Let's Encrypt)
[DMZ nginx]  (Rocky Linux 9.7)
   │  HTTP   →  http://<docker-host>:8090
[internal Caddy]  → app:3000  (namecard compose stack, user `encard`)
```

The internal Caddy publishes on **8090**, not 80 — the docker host is shared with
another compose app already on 8080. See [`docker.md`](./docker.md).

## Prerequisites (before certbot)

1. **DNS** — `namecard.example.com` A/AAAA record resolves to the DMZ nginx's
   **public** IP. Verify: `dig +short namecard.example.com`.
2. **Firewall** — 80 and 443 open inbound on the DMZ host:
   ```bash
   sudo firewall-cmd --add-service=http --add-service=https --permanent
   sudo firewall-cmd --reload
   ```
3. **nginx installed & running**: `sudo dnf install -y nginx && sudo systemctl enable --now nginx`.
4. **SELinux** (enforcing by default on Rocky) — allow nginx to make the upstream
   proxy connection to the docker host, otherwise `proxy_pass` returns 502:
   ```bash
   sudo setsebool -P httpd_can_network_connect 1
   ```
5. **ACME webroot** exists: `sudo mkdir -p /var/www/certbot`.

## Step 1 — install the baseline (pre-TLS) config

Copy the baseline server block to the DMZ host and set the docker host IP:

```bash
sudo cp namecard.example.com.conf /etc/nginx/conf.d/
sudo sed -i 's/<DOCKER_HOST_IP>/10.x.x.x/' /etc/nginx/conf.d/namecard.example.com.conf
sudo nginx -t && sudo systemctl reload nginx
```

At this point `http://namecard.example.com` should already proxy to the app
over plain HTTP — good for a quick end-to-end smoke test before issuing the cert.

## Step 2 — issue the certificate (certbot, webroot method)

The webroot method leaves you in full control of the hand-written config (certbot
only writes the cert files, not your server blocks).

```bash
sudo dnf install -y epel-release
sudo dnf install -y certbot
sudo certbot certonly --webroot -w /var/www/certbot \
  -d namecard.example.com \
  --agree-tos -m ssl-admin@example.com --no-eff-email
```

Certbot writes:
`/etc/letsencrypt/live/namecard.example.com/{fullchain.pem,privkey.pem}`
plus its recommended `options-ssl-nginx.conf` and `ssl-dhparams.pem`.

> **Alternative — nginx plugin.** `sudo dnf install -y python3-certbot-nginx` then
> `sudo certbot --nginx -d namecard.example.com` will edit the config for you
> (add the :443 block + redirect). Use this only if you prefer certbot-managed
> configs; otherwise stick with the webroot method + Step 3.

## Step 3 — enable TLS (add the `:443` block)

Replace the baseline file's contents with the post-TLS version below (keep the
ACME location on :80 so **renewals keep working**), then reload:

```nginx
upstream namecard_backend {
    server 10.x.x.x:8090;   # docker host, internal Caddy
    keepalive 16;
}

# Port 80 — ACME challenge + redirect everything else to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name namecard.example.com;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
        default_type "text/plain";
    }
    location / { return 301 https://$host$request_uri; }
}

# Port 443 — TLS terminates here; forward plain HTTP to internal Caddy
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name namecard.example.com;

    ssl_certificate     /etc/letsencrypt/live/namecard.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/namecard.example.com/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    location / {
        proxy_pass         http://namecard_backend;
        proxy_http_version 1.1;

        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        # Overwrite (not append) client-supplied XFF — see baseline .conf notes.
        proxy_set_header X-Forwarded-For   $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;   # = https here
        proxy_set_header X-Forwarded-Host  $host;

        # Large OIDC callback Set-Cookie headers — see troubleshooting below.
        proxy_buffer_size       16k;
        proxy_buffers           4 16k;
        proxy_busy_buffers_size 16k;

        proxy_connect_timeout 5s;
        proxy_read_timeout    60s;
        proxy_send_timeout    60s;
    }
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## Step 4 — verify

```bash
curl -I https://namecard.example.com/manifest.webmanifest   # expect 200
```

Confirm the app sees HTTPS: the `X-Forwarded-Proto: https` set here flows through
Caddy (which preserves it) to Auth.js, so OIDC redirect URLs and the `Secure`
session cookie are generated for the public origin. This must match
`AUTH_URL=https://namecard.example.com` in `/home/encard/data/.env.prod`.

## Renewals

Certbot installs a systemd timer (`certbot-renew.timer`) that renews
automatically. Because the ACME challenge location stays on :80, no downtime is
needed. Reload nginx after renewal via a deploy hook:

```bash
echo -e '#!/bin/sh\nsystemctl reload nginx' | sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
sudo certbot renew --dry-run   # verify the whole flow
```

## Troubleshooting

| Symptom                                                                                                      | Likely cause                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `502 Bad Gateway`                                                                                            | SELinux blocking the upstream — run the `setsebool` in prerequisites; or wrong `<DOCKER_HOST_IP>`/port (must be `:8090`); or the compose stack isn't up.                                                                       |
| ACME challenge fails                                                                                         | DNS not pointing at this host yet, or firewall closed on :80, or `/var/www/certbot` missing/unreadable.                                                                                                                        |
| Redirect loop / insecure cookies                                                                             | `X-Forwarded-Proto` not reaching the app as `https`, or `AUTH_URL` not set to the public HTTPS origin.                                                                                                                         |
| Rate limiting sees one IP for all users                                                                      | XFF being **appended** instead of overwritten — use `$remote_addr`, not `$proxy_add_x_forwarded_for`.                                                                                                                          |
| `502` right after M365 login, at `/api/auth/callback/...`; error log says **`upstream sent too big header`** | Auth.js sets large `Set-Cookie` headers on the OIDC callback that overflow nginx's default proxy buffers. Add `proxy_buffer_size 16k; proxy_buffers 4 16k; proxy_busy_buffers_size 16k;` to the `location /` block and reload. |
