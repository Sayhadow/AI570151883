# AI Image Platform

Internal MVP for an AI image generation website.

## Current milestone

This scaffold covers the first foundation slice:

- `apps/web`: Next.js user/admin web app
- `apps/api`: NestJS API service
- `apps/worker`: BullMQ generation worker
- `packages/shared`: shared domain types and constants
- `packages/db`: Prisma schema and database client package
- `docker-compose.yml`: PostgreSQL, Redis, and MinIO for local development

## Local setup

```bash
cp .env.example .env
corepack pnpm install
docker compose up -d
corepack pnpm db:generate
corepack pnpm db:migrate
corepack pnpm db:seed
corepack pnpm dev
```

Default local URLs:

- Web: http://localhost:3000
- API: http://localhost:4000
- MinIO console: http://localhost:9001

## Seed data

`corepack pnpm db:seed` creates:

- Admin email: `admin@example.com`
- Admin password: `Admin12345`
- Initial invite code: `INTERNAL-TEST-2026`

You can override these with:

```bash
SEED_ADMIN_EMAIL=owner@example.com SEED_ADMIN_PASSWORD=change-me SEED_INVITE_CODE=YOUR-CODE corepack pnpm db:seed
```

## Phase 2 auth routes

API:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/agreement/accept`
- `GET /api/admin/invite-codes`
- `POST /api/admin/invite-codes`

Web:

- `/register`
- `/login`
- `/agreement`
- `/dashboard`
- `/admin/invite-codes`

## MVP build order

1. Auth, invite codes, and first-login agreement
2. User balance and point transactions
3. Generation task API and queue
4. Mock provider worker
5. Creative workspace and result gallery
6. Admin users, invite codes, points, and task logs
7. Template gallery and Remix
8. Real AI provider adapters and failover
