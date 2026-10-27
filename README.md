# Pose Coach website

This folder is the complete React + Vite frontend. It can be deployed separately from the Flask API in `../server`.

## Local development

```powershell
npm ci
npm run dev
```

Vite proxies `/api` requests to `http://127.0.0.1:5001` by default. Override that local API address with `VITE_DEV_API_TARGET` if needed.

## Vercel deployment

Import the repository into Vercel and set **Root Directory** to `client`. Use `npm ci`, `npm run build`, and `dist` if Vercel does not detect those settings automatically. Add `VITE_API_BASE_URL` with the public Render server URL (without `/api` or a trailing slash), then deploy. The `vercel.json` rewrite supports direct navigation to React Router pages.

Follow the step-by-step guide in [`../DEPLOYMENT.md`](../DEPLOYMENT.md). Never put server credentials or AI provider keys in this frontend folder.
