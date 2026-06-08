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
- Admin points: `1000`
- Initial invite code: `INTERNAL-TEST-2026`

You can override these with:

```bash
SEED_ADMIN_EMAIL=owner@example.com SEED_ADMIN_PASSWORD=change-me SEED_ADMIN_POINTS=5000 SEED_INVITE_CODE=YOUR-CODE corepack pnpm db:seed
```

## Phase 2 auth and invite routes

API:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/agreement/accept`
- `GET /api/admin/invite-codes`
- `POST /api/admin/invite-codes`

## Phase 3 points routes

API:

- `GET /api/points/balance`
- `GET /api/points/transactions`
- `GET /api/admin/users`
- `POST /api/admin/users/:userId/points`

The API points service also exposes internal methods for the upcoming generation flow:

- `reserveGenerationPoints(userId, taskId, amount, reason?)`
- `captureGenerationHold(holdTransactionId, reason?)`
- `refundGenerationHold(holdTransactionId, reason?)`

## Phase 4 generation routes

API:

- `POST /api/generation-tasks`
- `GET /api/generation-tasks`
- `GET /api/generation-tasks/:taskId`

The workspace can create generation tasks. Creating a task reserves points, enqueues a BullMQ job, and the worker moves the task through `queued -> processing -> succeeded`. Result assets are persisted as each image completes, so the workspace can reveal images while a batch is still processing.

Worker concurrency can be tuned in `.env`:

- `WORKER_CONCURRENCY`: number of batch tasks consumed at the same time
- `PROVIDER_IMAGE_CONCURRENCY`: maximum concurrent image requests inside each batch
- `MOCK_PROVIDER_IMAGE_STAGGER_MS`: local Mock Provider delay between progressive image results

Prompts containing `[fail]` intentionally exercise a full Mock Provider refund. Prompts containing `[fail:N]` fail the Nth Mock Provider image so partial capture and refund behavior can be tested locally.

## Phase 5 workspace and gallery

API:

- `GET /api/assets/results`

Web:

- `/workspace/home`
- `/gallery`

## Phase 6 admin operations

API:

- `GET /api/admin/overview`
- `GET /api/admin/tasks`

Web:

- `/admin/tasks`

## Phase 7 templates and Remix

API:

- `GET /api/templates`
- `GET /api/templates/:templateId`
- `POST /api/templates/:templateId/remix`

Web:

- `/templates`

Current web pages:

- `/register`
- `/login`
- `/agreement`
- `/workspace/home`
- `/dashboard` redirects to `/workspace/home`
- `/workspace` redirects to `/workspace/home`
- `/gallery`
- `/templates`
- `/admin/invite-codes`
- `/admin/tasks`
- `/admin/users`

## MVP build order

1. Auth, invite codes, and first-login agreement
2. User balance and point transactions
3. Generation task API and queue
4. Mock provider worker
5. Creative workspace and result gallery
6. Admin users, invite codes, points, and task logs
7. Template gallery and Remix
8. Real AI provider adapters and failover
