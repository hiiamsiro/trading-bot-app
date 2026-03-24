# Trading Bot App - MVP

A demo trading bot web application for paper trading (no real money involved).

## Tech Stack

### Frontend
- **Next.js 16** — App Router, production build uses **webpack** (`next build --webpack`)
- **React 19**
- **TypeScript**
- **ESLint 9** — flat config (`eslint.config.mjs`) with `eslint-config-next`
- **Tailwind CSS 3**
- **Radix UI / shadcn-style components**
- **Zustand** — client state
- **Socket.IO client** — real-time connection to the API

### Backend
- **NestJS 11** — Node API framework
- **TypeScript**
- **Prisma 6** — ORM and migrations
- **PostgreSQL** — primary database
- **Redis** — cache and BullMQ broker
- **BullMQ** — queues and workers
- **Socket.IO** — WebSocket server (same port as HTTP)
- **Passport JWT** — authentication
- **Swagger** (`@nestjs/swagger` 11) — `/api` docs

### Infrastructure (Docker Compose)
- **Node.js 22** (Alpine) — frontend and backend images
- **PostgreSQL 17** (Alpine)
- **Redis 8** (Alpine)
- **Docker Compose v2** — `docker compose` (plugin)

## Project Structure

```
trading-bot-app/
├── frontend/                 # Next.js frontend application
│   ├── src/
│   │   ├── app/             # Next.js App Router pages
│   │   ├── components/      # React components
│   │   ├── lib/             # Utilities (API client, WebSocket)
│   │   ├── hooks/           # Custom React hooks
│   │   ├── types/           # TypeScript type definitions
│   │   └── store/           # Zustand state management
│   ├── Dockerfile
│   └── package.json
│
├── backend/                  # NestJS backend application
│   ├── src/
│   │   ├── auth/            # Authentication module
│   │   ├── users/           # User management
│   │   ├── bots/            # Bot management
│   │   ├── trades/          # Trade management
│   │   ├── market-data/     # Market data & WebSocket
│   │   ├── jobs/            # BullMQ job processors
│   │   ├── prisma/          # Prisma service
│   │   └── common/          # Shared utilities
│   ├── prisma/
│   │   └── schema.prisma    # Database schema
│   ├── Dockerfile
│   └── package.json
│
├── docker-compose.yml        # Docker orchestration
├── .env.example              # Environment variables template
└── README.md                 # This file
```

## Database Schema

### Core Tables

- **users** - User accounts
- **bots** - Trading bot configurations
- **strategy_configs** - Bot strategy parameters
- **trades** - Trade execution history
- **bot_logs** - Bot activity logs
- **execution_sessions** - Bot execution sessions with P&L tracking

### Enums

- **BotStatus**: RUNNING, STOPPED, PAUSED, ERROR
- **TradeSide**: BUY, SELL
- **TradeStatus**: PENDING, EXECUTED, CANCELLED, FAILED
- **LogLevel**: INFO, WARNING, ERROR, DEBUG

## Getting Started

### Prerequisites

- **Docker Desktop** (or Docker Engine) with **Docker Compose v2**
- **Node.js ≥ 20.9** (recommended **22.x**) if you run `npm` on the host instead of only in containers
- **npm**

### Quick Start with Docker

1. **Go to the project root**

```bash
cd trading-bot-app
```

2. **Create environment files**

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Adjust ports or secrets if needed. Set `NEXT_PUBLIC_WS_URL` to the **HTTP** base URL of the API (e.g. `http://localhost:3001`). Socket.IO uses that origin; you do not need a separate `ws://` URL.

3. **Build images** (after dependency or Dockerfile changes)

```bash
docker compose build
```

Use `docker compose build --no-cache` for a fully clean rebuild.

4. **Start all services**

```bash
docker compose up -d
```

This starts **PostgreSQL** (`5432`), **Redis** (`6379`), the **backend** (`3001`), and the **frontend** (`3000`). The backend development image runs `npx prisma migrate deploy`, then `npx prisma db seed`, then `npm run start:dev` (see `backend/Dockerfile`).

5. **Open the application**

- Frontend: http://localhost:3000  
- Backend API: http://localhost:3001  
- Swagger: http://localhost:3001/api  

6. **Demo logins (seeded)**

| Email | Password |
|-------|----------|
| demo@example.com | password123 |
| demo2@example.com | password123 |

The first account gets sample bots, trades, and logs. The seed script is idempotent: if a bot named **Demo BTC Bot** already exists for `demo@example.com`, it skips creating demo bots/trades again.

If migrations or seed fail (for example after a bad volume state), run them manually:

```bash
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npx prisma db seed
```

### Local Development (Without Docker)

#### Backend Setup

1. **Install dependencies**

```bash
cd backend
npm install
```

2. **Start PostgreSQL and Redis**

```bash
# Databases only
docker compose up -d postgres redis
```

3. **Configure environment**

```bash
cp .env.example .env
# Edit .env with your local settings
```

4. **Run migrations**

```bash
npm run prisma:migrate
npm run prisma:generate
```

5. **Start backend**

```bash
npm run start:dev
```

Backend will run on http://localhost:3001

#### Frontend Setup

1. **Install dependencies**

```bash
cd frontend
npm install
```

2. **Configure environment**

```bash
cp .env.example .env
# Edit .env if needed
```

3. **Start frontend**

```bash
npm run dev
```

Frontend will run on http://localhost:3000

## Available Scripts

### Backend

```bash
npm run start:dev      # Start development server
npm run build          # Build for production
npm run start:prod     # Start production server
npm run prisma:migrate # Run database migrations (dev)
npm run prisma:generate # Generate Prisma client
npm run prisma:seed    # Seed demo users, bots, trades, logs
npm run prisma:studio  # Open Prisma Studio
npm run lint           # Lint code
```

### Frontend

```bash
npm run dev            # Start development server
npm run build          # Production build (uses webpack: next build --webpack)
npm run start          # Start production server
npm run lint           # Lint code (ESLint 9 flat config)
```

## API Documentation

Once the backend is running, access the Swagger documentation at:

**http://localhost:3001/api**

### Main API Endpoints

#### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login user

#### Users
- `GET /users/me` - Get current user profile

#### Bots
- `GET /bots` - Get all bots for current user
- `GET /bots/:id` - Get bot by ID
- `POST /bots` - Create new bot
- `PUT /bots/:id` - Update bot
- `DELETE /bots/:id` - Delete bot

#### Trades
- `GET /trades` - Get all trades for current user
- `GET /trades/:id` - Get trade by ID

### WebSocket (Socket.IO)

Connect the client to the same **HTTP** origin as the API (for example `http://localhost:3001`). Events are broadcast to all connected clients; the payload includes `userId` so the frontend can ignore other users’ data.

#### Server → client

- `market-data` — Simulated tick: `{ symbol, price, timestamp }`
- `bot-status` — `{ botId, userId, status, symbol }`
- `new-trade` — Trade fields from Prisma plus `userId` and `botId`
- `bot-log` — Log row fields plus `userId` (emitted when a log line is written)

## Environment Variables

### Root `.env`

```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=trading_bot
POSTGRES_PORT=5432
REDIS_PORT=6379
BACKEND_PORT=3001
FRONTEND_PORT=3000
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=http://localhost:3001
```

### Backend `.env`

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/trading_bot?schema=public
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
```

### Frontend `.env`

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=http://localhost:3001
```

Use `http://` for `NEXT_PUBLIC_WS_URL` so Socket.IO can negotiate the transport.

## Docker Commands

Compose uses the v2 CLI: **`docker compose`** (space, not hyphen).

### Start all services

```bash
docker compose up -d
```

### Stop all services

```bash
docker compose down
```

### View logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f postgres
```

### Rebuild services

```bash
docker compose up -d --build
```

### Update Existing Machine (Source Was Old)

Use this flow when your machine already has Docker services/data, but local source code is behind (for example: new Prisma migrations were added on another machine).

```bash
# 1) Stop currently running services (keep local volumes/data)
docker compose down

# 2) Pull latest source
git pull

# 3) Rebuild and start services with updated source
docker compose up -d --build

# 4) Apply DB migrations and seed data
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npx prisma db seed
```

If migration fails because local DB state is out of sync with migration history, reset local volumes and bootstrap again:

```bash
docker compose down -v
docker compose up -d --build
docker compose exec backend npx prisma migrate deploy
docker compose exec backend npx prisma db seed
```

`docker compose down -v` removes local PostgreSQL/Redis data. Use it only when you accept local data reset.

### Access a container shell

```bash
# Backend
docker compose exec backend sh

# Frontend
docker compose exec frontend sh

# PostgreSQL (adjust user/database if your .env differs)
docker compose exec postgres psql -U postgres -d trading_bot
```

### Reset volumes (PostgreSQL + Redis data)

```bash
docker compose down -v
docker compose up -d
```

This removes named volumes (`postgres_data`, `redis_data`). On the next start, Postgres initializes a **new** data directory and the backend runs migrations and seed again.

To re-seed **without** wiping volumes:

```bash
docker compose exec backend npx prisma db seed
```

## Development Workflow

1. **Make changes** to your code
2. **Hot reload** is enabled for both frontend and backend
3. **Check logs** for errors: `docker compose logs -f`
4. **Run migrations** when the schema changes: `docker compose exec backend npm run prisma:migrate`
5. **Test API** using Swagger UI at http://localhost:3001/api

## Troubleshooting

### Port already in use

```bash
# Check what's using the port
lsof -i :3000  # or :3001, :5432, :6379

# Kill the process
kill -9 <PID>
```

### Database connection issues

```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Check PostgreSQL logs
docker compose logs postgres

# Restart PostgreSQL
docker compose restart postgres
```

### Prisma issues

```bash
# Regenerate Prisma client
docker compose exec backend npm run prisma:generate

# Reset database (destructive)
docker compose exec backend npx prisma migrate reset
```

### Frontend build errors

```bash
# Clear Next.js cache
cd frontend
rm -rf .next node_modules
npm install
```

## Phase 1 Checklist

- [x] Project structure setup
- [x] Docker Compose configuration
- [x] PostgreSQL setup
- [x] Redis setup
- [x] Backend scaffold (NestJS)
- [x] Frontend scaffold (Next.js)
- [x] Prisma schema with all tables
- [x] Authentication module (JWT)
- [x] Users module
- [x] Bots module
- [x] Trades module
- [x] Market data module (WebSocket)
- [x] Jobs module (BullMQ)
- [x] Swagger documentation
- [x] shadcn/ui components
- [x] API client
- [x] WebSocket client
- [x] State management (Zustand)
- [x] Dockerfiles for frontend and backend
- [x] README with setup instructions

## Important Notes

⚠️ **This is a demo application for paper trading only**
- No real money involved
- No real broker integration
- Simulated market data
- For educational purposes only

## License

MIT

## Support

For issues and questions, please create an issue in the repository.
