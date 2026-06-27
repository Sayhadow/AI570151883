# Deployment

This project is a pnpm monorepo with:

- `apps/web`: Next.js frontend, deploy to Vercel.
- `apps/api`: NestJS API, deploy to a Node server runtime such as Railway, Render, Fly.io, or a VPS.
- `apps/worker`: BullMQ worker, deploy to a persistent Node worker runtime.
- `packages/db`: Prisma schema and client.
- `packages/storage`: local or S3-compatible asset storage.

## 1. Supabase database

Create a Supabase project and copy the Postgres connection string.

For Prisma migrations, use a direct database connection:

```text
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-...pooler.supabase.com:5432/postgres?schema=public
```

Then run migrations and seed data locally:

```powershell
corepack pnpm db:migrate
corepack pnpm db:seed
```

## 2. Supabase Storage or another S3-compatible bucket

Create a private bucket for generated assets, then configure the API and worker with:

```text
ASSET_STORAGE_DRIVER=s3
S3_ENDPOINT=https://<project-ref>.supabase.co/storage/v1/s3
S3_REGION=auto
S3_BUCKET=<bucket-name>
S3_ACCESS_KEY=<supabase-s3-access-key>
S3_SECRET_KEY=<supabase-s3-secret-key>
S3_FORCE_PATH_STYLE=true
```

Local development can keep:

```text
ASSET_STORAGE_DRIVER=local
GENERATED_ASSET_DIR=.generated-assets
```

## 3. Redis

The generation queue uses BullMQ, which is command-heavy and should use a persistent Redis service such as Railway Redis. Use Upstash Redis only for lightweight rate limiting or short-lived cache keys.

Set these values on both API and worker:

```text
REDIS_QUEUE_URL=redis://default:<password>@<railway-redis-private-host>:6379
GENERATION_QUEUE_NAME=generation
```

Set this value on the API:

```text
RATE_LIMIT_REDIS_URL=rediss://default:<password>@<upstash-host>:6379
```

`REDIS_URL` is still supported as a fallback for local development and older environments, but production should prefer the dedicated variables above.

## 4. API runtime

Deploy `apps/api` to a persistent Node runtime.

Build and start commands:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm --filter @ai-image/api build
corepack pnpm --filter @ai-image/api start
```

Required production variables:

```text
NODE_ENV=production
API_PORT=4000
API_BODY_LIMIT=10mb
WEB_ORIGIN=https://sayhadowai.com
DATABASE_URL=<supabase-postgres-url>
REDIS_QUEUE_URL=<railway-redis-url>
RATE_LIMIT_REDIS_URL=<upstash-redis-url>
SESSION_SECRET=<long-random-secret>
ASSET_STORAGE_DRIVER=s3
S3_ENDPOINT=<s3-endpoint>
S3_REGION=auto
S3_BUCKET=<bucket-name>
S3_ACCESS_KEY=<s3-access-key>
S3_SECRET_KEY=<s3-secret-key>
S3_FORCE_PATH_STYLE=true
AI_PROVIDER=provider_a
PROVIDER_A_BASE_URL=<image-provider-base-url>
PROVIDER_A_API_KEY=<image-provider-api-key>
PROVIDER_A_MODEL=<image-provider-model>
PROVIDER_A_IMAGE_PATH=/v1/images/generations
PROVIDER_A_TASK_PATH=/v1/tasks
```

## 5. Worker runtime

Deploy `apps/worker` to a persistent worker process.

Build and start commands:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm --filter @ai-image/worker build
corepack pnpm --filter @ai-image/worker start
```

Use the same `DATABASE_URL`, `REDIS_URL`, storage variables, and provider variables as the API.

## 6. Vercel frontend

Import the repository into Vercel and configure:

```text
Root Directory: apps/web
Framework Preset: Next.js
Install Command: corepack pnpm install --frozen-lockfile
Build Command: corepack pnpm build
Output Directory: .next
```

Environment variables:

```text
NEXT_PUBLIC_API_BASE_URL=https://api.sayhadowai.com
```

## 7. Cloudflare DNS

Create DNS records:

```text
sayhadowai.com      -> Vercel frontend target
www.sayhadowai.com  -> Vercel frontend target
api.sayhadowai.com  -> API runtime target
```

Keep the Cloudflare proxy disabled while first verifying Vercel and the API. Turn it on after HTTPS and health checks work.
