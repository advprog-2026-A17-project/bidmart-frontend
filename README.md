# BidMart Frontend

React + Vite UI for the BidMart marketplace.

## Local development (recommended)

Backend services run in Docker; the frontend runs **on your machine** for fast HMR and stable `node_modules`.

```bash
# Terminal 1 — backend stack
cd ../bidmart-infrastructure
cp .env.example .env   # first time only
docker compose up -d --build

# Terminal 2 — frontend
cd bidmart-frontend
cp .env.example .env   # first time only
npm ci
npm run dev
```

Open **http://localhost:5173** (login: http://localhost:5173/login).

API traffic goes to the gateway at `http://localhost:8000` via the Vite dev proxy (when `VITE_API_BASE_URL` is empty in `.env`).

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm test` | Contract tests |
| `npm run test:e2e` | Playwright |

## Docs

See [`docs/`](docs/) and [`docs/4. Software Deployment.md`](docs/4.%20Software%20Deployment.md).
