# model.kanadakurniwan.com

Daftar model AI dari [OpenRouter](https://openrouter.ai) — cari yang **terbaik** dan **termurah**, plus model **gratis**.

## Stack

- [Astro](https://astro.build) — static site generator
- [Tailwind CSS v4](https://tailwindcss.com)
- GitHub Actions — auto-refresh data tiap 6 jam, deploy ke GitHub Pages

## Struktur

- `src/data/models.json` — data model (di-refresh via Actions)
- `src/pages/index.astro` — list dengan filter & sort client-side
- `src/pages/free.astro` — hanya model gratis
- `src/pages/cheapest.astro` — 60 model termurah
- `src/pages/model/[slug].astro` — halaman detail per model (generated)
- `scripts/fetch-models.mjs` — fetch dari `https://openrouter.ai/api/v1/models`
- `.github/workflows/deploy.yml` — build & deploy ke GitHub Pages
- `.github/workflows/refresh-models.yml` — refresh data tiap 6 jam

## Setup lokal

```bash
npm install
npm run fetch          # ambil data model (opsional: set OPENROUTER_API_KEY)
npm run dev            # http://localhost:4321
npm run build          # output ke ./dist
```

## Deploy ke GitHub Pages

1. Buat repo `kanadakurniawan/model`
2. Push branch `main` ke GitHub
3. Settings → Pages → Source: **GitHub Actions**
4. Settings → Secrets and variables → Actions → tambah `OPENROUTER_API_KEY` (opsional, untuk akses data lebih banyak)
5. Untuk custom domain `model.kanadakurniwan.com`:
   - DNS: buat 4 A record ke `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - CNAME sudah ada di `public/CNAME`
   - Settings → Pages → Custom domain: `model.kanadakurniwan.com` → centang **Enforce HTTPS**