# Trading Bot App (MVP)

Demo trading bot web app for paper trading (no real money involved).

## Stack

**Frontend**
- Next.js 16 (App Router, production build uses `next build --webpack`)
- React 19 + TypeScript
- Tailwind CSS
- Zustand
- Socket.IO client

**Backend**
- NestJS 11 + TypeScript
- Prisma 6
- PostgreSQL 17
- Redis 8 + BullMQ
- Socket.IO (same port as HTTP)
- Swagger at `/api`

## Repo Layout

```
trading-bot-app/
  frontend/                # Next.js app
  backend/                 # NestJS API
  docker-compose.yml       # Local dev (bind mounts + hot reload)
  docker-compose.prod.yml  # Production-style containers (no bind mounts)
  .env.example             # Compose env template
```

## Local Development (Docker, recommended)

1) Create env files

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

2) Build + start

```bash
docker compose up -d --build
```

3) Open
- Frontend: `http://localhost:3000`
- Backend health: `http://localhost:3001/health`
- Swagger: `http://localhost:3001/api`

The backend container runs `prisma migrate deploy` and `prisma db seed` on startup for local bootstrapping.

### Demo accounts (seeded)
- `admin@example.com` / `password123`
- `user@example.com` / `password123`

### Recreate the demo dataset

```bash
docker compose exec backend npm run prisma:seed -- --reset
```

## Tests

Backend tests:

```bash
docker compose exec backend npm test
```

## Production-Style Deployment (Docker)

`docker-compose.prod.yml` runs the production stages from the Dockerfiles (no bind mounts) and applies DB migrations on startup.

1) Set required variables in your root `.env`
- `JWT_SECRET` (required)
- `CORS_ORIGIN` (required; comma-separated allowlist, e.g. `http://localhost:3000`)

2) Build + start

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

3) Verify
- Frontend: `http://localhost:3000`
- Backend health: `http://localhost:3001/health`

Notes:
- The backend runs `npx prisma migrate deploy` automatically on container start.
- The frontend defaults to calling the API/WebSocket on the same host at port `3001` if `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_WS_URL` are not set.
- If you deploy behind a reverse proxy (TLS, different ports, separate domains), set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL` to the browser-reachable API base URL.

## Useful Commands

```bash
# Logs
docker compose logs -f backend
docker compose logs -f frontend

# DB migrations (inside backend container)
docker compose exec backend npx prisma migrate deploy

# Shells
docker compose exec backend sh
docker compose exec frontend sh
```

## Troubleshooting

### Backend is `unhealthy` (Prisma error `P3005`)

If the backend container keeps restarting and `docker compose logs -f backend` shows:

- `Error: P3005`
- `The database schema is not empty`

then your local Postgres volume contains an old/non-empty database state (common after changing migrations).

Quick fix (deletes local Postgres + Redis data for this project):

```bash
docker compose down -v
docker compose up -d --build
```

If you see `P3009` (failed migration) or Postgres logs like `type "TradeStatus" does not exist`, it usually means migrations did not run cleanly on a fresh DB. Resetting volumes with `docker compose down -v` is the fastest way to recover.

## Important Notes

This is a demo application for paper trading only:
- No real money involved
- No broker integrations
- Public market data sources only (no private keys)
