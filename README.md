# Trading Bot App - MVP

A demo trading bot web application for paper trading (no real money involved).

## Tech Stack

### Frontend
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - Beautiful UI components
- **Zustand** - State management
- **Socket.io Client** - Real-time WebSocket connection

### Backend
- **NestJS** - Progressive Node.js framework
- **TypeScript** - Type-safe JavaScript
- **Prisma** - Modern database ORM
- **PostgreSQL** - Relational database
- **Redis** - In-memory data store
- **BullMQ** - Queue and job processing
- **Socket.io** - WebSocket server
- **JWT** - Authentication
- **Swagger** - API documentation

### Infrastructure
- **Docker & Docker Compose** - Containerization
- **PostgreSQL 15** - Database
- **Redis 7** - Cache and queue

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

- **Docker** and **Docker Compose** installed
- **Node.js 20+** (for local development without Docker)
- **npm** or **yarn**

### Quick Start with Docker

1. **Clone the repository**

```bash
cd trading-bot-app
```

2. **Create environment files**

```bash
# Copy root .env.example
cp .env.example .env

# Copy backend .env.example
cp backend/.env.example backend/.env

# Copy frontend .env.example
cp frontend/.env.example frontend/.env
```

3. **Start all services with Docker Compose**

```bash
docker-compose up -d
```

This will start:
- PostgreSQL on port `5432`
- Redis on port `6379`
- Backend API on port `3001`
- Frontend on port `3000`

4. **Run database migrations**

```bash
# Enter backend container
docker exec -it trading-bot-backend sh

# Run Prisma migrations
npm run prisma:migrate

# Generate Prisma client
npm run prisma:generate

# Exit container
exit
```

5. **Access the application**

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Swagger API Docs: http://localhost:3001/api

### Local Development (Without Docker)

#### Backend Setup

1. **Install dependencies**

```bash
cd backend
npm install
```

2. **Start PostgreSQL and Redis**

```bash
# Using Docker for databases only
docker-compose up -d postgres redis
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
npm run prisma:migrate # Run database migrations
npm run prisma:generate # Generate Prisma client
npm run prisma:studio  # Open Prisma Studio
npm run lint           # Lint code
```

### Frontend

```bash
npm run dev            # Start development server
npm run build          # Build for production
npm run start          # Start production server
npm run lint           # Lint code
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

### WebSocket Events

#### Client → Server
- Connect to `ws://localhost:3001`

#### Server → Client
- `market-data` - Real-time market price updates
- `bot-status` - Bot status changes
- `new-trade` - New trade executed

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
NEXT_PUBLIC_WS_URL=ws://localhost:3001
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
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

## Docker Commands

### Start all services

```bash
docker-compose up -d
```

### Stop all services

```bash
docker-compose down
```

### View logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Rebuild services

```bash
docker-compose up -d --build
```

### Access container shell

```bash
# Backend
docker exec -it trading-bot-backend sh

# Frontend
docker exec -it trading-bot-frontend sh

# PostgreSQL
docker exec -it trading-bot-postgres psql -U postgres -d trading_bot
```

### Reset database

```bash
docker-compose down -v
docker-compose up -d
docker exec -it trading-bot-backend npm run prisma:migrate
```

## Development Workflow

1. **Make changes** to your code
2. **Hot reload** is enabled for both frontend and backend
3. **Check logs** for errors: `docker-compose logs -f`
4. **Run migrations** when schema changes: `docker exec -it trading-bot-backend npm run prisma:migrate`
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
docker-compose logs postgres

# Restart PostgreSQL
docker-compose restart postgres
```

### Prisma issues

```bash
# Regenerate Prisma client
docker exec -it trading-bot-backend npm run prisma:generate

# Reset database
docker exec -it trading-bot-backend npx prisma migrate reset
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

## Next Steps (Phase 2+)

- Implement authentication UI (login/register forms)
- Implement bot management UI
- Implement trade history UI
- Add market data simulation
- Implement trading strategies
- Add bot execution logic
- Implement real-time updates via WebSocket
- Add charts and visualizations
- Add backtesting functionality
- Add performance metrics

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
