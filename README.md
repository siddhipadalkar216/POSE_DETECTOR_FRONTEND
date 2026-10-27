# Pose Coach website

This folder is the complete React + Vite frontend. It can be deployed separately from the Flask API in `../server`.

## Local development

```powershell
npm ci
npm run dev
```

Vite proxies `/api` requests to `http://127.0.0.1:5001` by default. Override that local API address with `VITE_DEV_API_TARGET` if needed.

## Deployment

This frontend can run on Render or Vercel. For the current Render frontend + Vercel API setup, set the Render static site's build environment variable `VITE_API_BASE_URL` to the Vercel API origin (without `/api` or a trailing slash), then redeploy the static site.

For a Vercel frontend, set **Root Directory** to `client`, use `npm ci`, `npm run build`, and output directory `dist` if those settings are not detected automatically. Set `VITE_API_BASE_URL` to the backend origin. `vercel.json` supports direct navigation to React Router pages.

Follow the step-by-step guide in [`../DEPLOYMENT.md`](../DEPLOYMENT.md). Never put server credentials or AI provider keys in this frontend folder.
