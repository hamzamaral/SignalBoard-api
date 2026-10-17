# SignalBoard API

Multi-source **public & private listing aggregator** with deadline tracking, profile-based matching, email alerts, and ICS reminders.

Companion UI: [SignalBoard-web](https://github.com/hamzamaral/SignalBoard-web)

## Stack

- NestJS 10 + Prisma 5 + PostgreSQL 16
- JWT access + refresh rotation, RBAC (`ADMIN` / `USER`)
- Swagger: `/api/docs`
- Source adapters (official open APIs are generally unavailable; see `AGENT_HANDOFF.md`)

## Quick start

```bash
cp .env.example .env
# If port 5432 is busy: POSTGRES_PORT=5433 docker compose up -d postgres
# and set DATABASE_URL host port to 5433
docker compose up -d postgres
npm install
npx prisma migrate dev
npm run db:seed   # or SEED_ON_EMPTY on boot
npm run dev
```

- API: http://localhost:3000/api/v1
- Swagger: http://localhost:3000/api/docs

### Demo users

| Email | Password | Role |
|-------|----------|------|
| admin@signalboard.local | Admin123! | ADMIN |
| user@signalboard.local | User123! | USER |

## Main endpoints

- `POST /auth/login|refresh|logout`, `GET /auth/me`
- `GET/POST /listings`, `POST /listings/parse` (admin)
- `GET /recommendations`, `GET/PUT /profile`
- `GET/POST /pipeline`, `GET/POST /reminders`, `GET /reminders/export.ics`
- `GET/PUT /settings/smtp|llm` (admin)
- `POST /ingest/run?source=ILAN_GOV` (admin)

## Notes for agents

Read **[AGENT_HANDOFF.md](./AGENT_HANDOFF.md)** before changing code. Update it after meaningful work.
