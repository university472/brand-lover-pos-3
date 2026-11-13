# Brand Lover POS — Web version (demo deployment)

The same app now runs in any browser (desktop, tablet, phone):

| Part | Folder | Host |
|---|---|---|
| Frontend (React) | `web/` + `src/renderer` | **Vercel** |
| Backend API (Node/Express) | `server/` + `src/main` (all desktop business logic, unchanged) | **Render** |
| Database (MySQL 8) | `database/` (schema + migrations applied automatically) | **Aiven** (free MySQL) |

The Electron desktop app still builds and works exactly as before (`npm run dev`, `npm run build:win`).

---

## 1. Database — Aiven (free MySQL)

1. Sign up at <https://console.aiven.io> → **Create service** → **MySQL** → plan **Free** → create.
2. Wait until the service shows **Running**.
3. Copy the **Service URI** from the Overview page. It looks like
   `mysql://avnadmin:XXXX@mysql-xxxx.aivencloud.com:12345/defaultdb?ssl-mode=REQUIRED`

Nothing else to do — the API creates all tables and demo data on first start.

## 2. Backend — Render

1. <https://dashboard.render.com> → **New** → **Blueprint** → connect GitHub → choose this repository.
2. Render reads `render.yaml` and creates **brand-lover-pos-api**. When asked, paste the Aiven
   Service URI into **DATABASE_URL** → **Apply**.
3. Wait for the deploy to go **Live** (first build ≈ 3–5 min). Open
   `https://<your-service>.onrender.com/api/health` → should show `{"ok":true,...}`.
4. Copy the service URL (e.g. `https://brand-lover-pos-api.onrender.com`).

## 3. Frontend — Vercel

1. <https://vercel.com/new> → import this GitHub repository.
2. Framework preset: **Other** (settings come from `vercel.json`, nothing to change).
3. **Environment Variables** → add
   `VITE_API_URL` = the Render URL from step 2.4 (no trailing slash).
4. **Deploy**. Open the Vercel URL → log in with a demo account.

> If you change `VITE_API_URL` later, redeploy on Vercel (it is baked in at build time).

## Demo logins (fresh database)

| User | Password | Sees |
|---|---|---|
| Administrator | `admin123` | Everything |
| Manager | `manager123` | Everything |
| Salesman | `sales123` | Counter Sale only |

They are also shown on the login screen (tap to fill) while `DEMO_MODE=true` on Render.
Set `DEMO_MODE=false` on Render to hide them for real use, and change the passwords in Settings.

## Good to know for the demo

- **Free Render servers sleep** after ~15 minutes without visitors. The first request then takes
  up to a minute — the app shows "Connecting to server…" and retries automatically. Open the site
  a minute before the meeting to wake it.
- **Printing** uses the browser print dialog (receipts, reports, barcode labels). Choose the
  thermal/label printer there, or "Save as PDF". Silent printing and raw Zebra (ZPL) printing are
  desktop-only.
- **Excel export** downloads the .xlsx file in the browser.
- Data is stored in Aiven and is shared by everyone who opens the site.
- To start again with fresh demo data: in Aiven, delete and recreate the `defaultdb` database
  (or create a new service), then restart the Render service.

## Run the web version locally

```bash
# terminal 1 — API on :4000 (uses DB_* from .env, or DATABASE_URL)
npm run server
# terminal 2 — website on :5173 (calls the local API)
npm run web:dev
```
