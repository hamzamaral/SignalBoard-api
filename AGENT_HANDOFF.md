# SignalBoard API — Agent Handoff

> Update this file after every meaningful change so a new chat can continue without rediscovering decisions.

## Purpose (neutral branding)

**SignalBoard** aggregates multi-source public & private listings, tracks deadlines/status, matches users by profile (KPSS/skills/certs), sends email alerts, exports ICS reminders.

Do **not** frame README/GitHub copy as “job seeking / memur başvurusu”. Domain is listing ops.

Repos

- API: https://github.com/hamzamaral/SignalBoard-api
- Web: https://github.com/hamzamaral/SignalBoard-web
- Local: `C:\github\SignalBoard-api`, `C:\github\SignalBoard-web`

## Stack

- NestJS 10, Prisma 5, PostgreSQL 16, Swagger `/api/docs`, URI versioning `/api/v1`
- Auth: JWT access + HMAC-hashed refresh rotation, global `JwtAuthGuard` + `RolesGuard`, `@Public()` / `@Roles()`
- Settings encryption: AES-256-GCM via `SETTINGS_ENCRYPTION_KEY`
- LLM parse: default **Ollama** (`OLLAMA_BASE_URL`); admin can set GEMINI/GROQ keys
- Matching: **rule score** (not LLM)
- Calendar: in-app reminders + **`.ics`** (no Google OAuth in MVP)
- Mail: admin SMTP → `NotificationOutbox` → `POST /ingest/flush-mail`

## Source / API reality

No official documented open APIs for most TR public portals.

| Source | Approach |
|--------|----------|
| ilan.gov.tr | Unofficial site backend `AdsByFilter` (`IlanGovAdapter`) |
| kamuilan / yerelyonetimler | Stub / paste / manual |
| Kariyer Kapısı / İŞKUR / Resmi Gazete | Manual + paste-parse |

## Dedup logic

1. Resolve institution (exact → alias → fuzzy)  
2. `fingerprint` from institution + title + position + source + externalKey  
3. Same fingerprint → update + `ListingRevision`  
4. Same org/title but **new apply window** after previous ended → new listing, old `CLOSED`, shared `listingGroupId`  
5. Soft similar open listing → `possibleDup=true`

## Key modules

`src/modules/{auth,users,institutions,listings,parse,matching,notifications,reminders,settings,ingest,pipeline,profile,health}`

## Env

See `.env.example`. Local DB often on **5433** if 5432 occupied (`POSTGRES_PORT=5433`).

## Demo

- admin@signalboard.local / Admin123!  
- user@signalboard.local / User123!  
- `SEED_ON_EMPTY=true` seeds on empty users table

## Commands

```bash
docker compose up -d postgres   # optional POSTGRES_PORT=5433
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
npm test
npm run build
```

## Completed (MVP)

- [x] Auth/RBAC, institutions, listings+dedup+revisions
- [x] Paste-parse (rules + LLM providers)
- [x] Profile matching + mail outbox + reminders/ICS
- [x] Admin SMTP/LLM settings
- [x] ilan.gov ingest adapter + stubs
- [x] Seed, Docker compose, unit test (normalize)

## Remaining / risks

- [ ] Richer HTML adapters for kamuilan / CSB
- [ ] e2e suite against test DB
- [ ] Google Calendar OAuth (optional later via provider interface)
- [ ] ilan.gov category filters / HTML changes may break ingest
- [ ] Ollama must be running for free LLM parse; falls back to rules

## Web companion

UI lives in SignalBoard-web. Keep API contracts stable or update both handoffs.
