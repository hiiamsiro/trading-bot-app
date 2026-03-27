You are working on a production-structured MVP trading bot web app.

Rules:
- Use Next.js for frontend
- Use NestJS for backend
- Use TypeScript everywhere
- Use Prisma + PostgreSQL
- Use Redis + BullMQ
- Use Docker Compose for local development
- Do NOT change architecture once defined
- Do NOT introduce new frameworks without approval
- Always follow existing folder structure
- Always generate complete code, no placeholders
- Always include imports
- Always ensure code compiles
- Do not over-engineer
- Keep code simple and readable
- This project is demo trading only, not real-money trading

## Testing

### Backend — Node.js `node:test`
- Test files: `backend/test/*.test.ts`
- Run: `npm test` (in backend/)
- Pattern: `makeXxxService()` factory + `mockFn`/`mockAsyncFn` helpers from `test/helpers.ts`
- No external I/O (no Prisma DB, no real Redis) — pure unit tests via dependency injection
- All test files are auto-imported by `test/all.test.ts`

### Frontend — Vitest + jsdom
- Test files: `frontend/src/**/*.test.{ts,tsx}`
- Setup deps: `npm install` (vitest + @testing-library/react + @vitejs/plugin-react + jsdom auto-installed)
- Config: `frontend/vitest.config.ts`
- Run: `npm test` (watch mode) or `npm run test:run` (CI/single-run)
- Pattern: `vi.mock()` for dependencies, `localStorage` stubbed in `src/test/setup.ts`
- Coverage target: store layer (`auth.store.ts`) + API client

### CI — GitHub Actions
- `.github/workflows/test.yml` runs backend + frontend tests on every push/PR
- Backend job: Node 20, PostgreSQL + Redis services, `npx prisma generate` + `npm test`
- Frontend job: Node 20, `npm run test:run`

### When to write tests (priority order)
1. **P0** — Core runtime loop: `BotExecutionProcessor`, `MarketDataProcessor`, `StrategyService`, `DemoTradingService`
2. **P1** — Business logic services: `BotsService`, `TradesService`, auth store, API client
3. **P2** — Integration/edge cases, frontend page components