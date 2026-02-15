# BlackDesk

BlackDesk is a personal productivity app with light/dark themes, built with Next.js App Router, Prisma, and NextAuth.

## Stack

- Next.js 14+ (App Router) + TypeScript
- Tailwind CSS
- Prisma ORM + PostgreSQL (Neon)
- NextAuth (Credentials + Google OAuth)
- FullCalendar (month/week/day + drag/drop)

## Environment

Copy `.env.example` to `.env` and fill values:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST-pooler.REGION.aws.neon.tech/DB_NAME?sslmode=require&pgbouncer=true&connect_timeout=15"
DIRECT_URL="postgresql://USER:PASSWORD@HOST.REGION.aws.neon.tech/DB_NAME?sslmode=require&connect_timeout=15"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-a-secret"
ENCRYPTION_SECRET="use-a-long-random-secret"
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
OPENAI_API_KEY=""
OPENAI_MODEL="gpt-4o-mini"
ANTHROPIC_API_KEY=""
GOOGLE_API_KEY=""
```

## Local Setup (Neon)

1. `npm install`
2. Set `.env` values using your Neon connection strings
3. Run migrations (recommended): `npx prisma migrate dev --name init`
4. (Alternative for quick sync) `npm run db:push`
5. `npm run dev`

Open `http://localhost:3000`.

## Vercel + Neon Deployment

1. In Vercel, import this GitHub repo.
2. In Vercel Project Settings -> Environment Variables, add:
   - `DATABASE_URL` (Neon pooled URL: `-pooler`, includes `pgbouncer=true`)
   - `DIRECT_URL` (Neon direct URL: non-pooler host)
   - `NEXTAUTH_URL` (your Vercel domain, e.g. `https://blackdesk.vercel.app`)
   - `NEXTAUTH_SECRET`
   - `ENCRYPTION_SECRET`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - Optional global LLM fallback keys:
     - `OPENAI_API_KEY`
     - `ANTHROPIC_API_KEY`
     - `GOOGLE_API_KEY`
3. Apply schema once to Neon from your machine:
   - `npm run db:push`
4. Redeploy in Vercel.

## Google OAuth Setup

For local:

- `http://localhost:3000/api/auth/callback/google`

For production:

- `https://YOUR_VERCEL_DOMAIN/api/auth/callback/google`

Then set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in both local `.env` and Vercel env vars.

## Optional Migrations Workflow

For a migration-first workflow later, you can switch from `db push` to:

1. `npx prisma migrate dev --name init`
2. Commit generated `prisma/migrations`
3. `npm run dev`

For this release, prompt storage is added in migration:

- `prisma/migrations/202602170001_agent_prompts/migration.sql`

## Demo Seed (Optional)

Create a local demo credentials user:

- Email: `demo@blackdesk.local`
- Password: `demo1234`

Run:

```bash
npm run prisma:seed
```

## Key Routes

- `/` landing page
- `/auth/login` login
- `/auth/register` registration
- `/app` dashboard home
- `/app/calendar` calendar
- `/app/tasks` tasks
- `/app/news` tabbed news section
- `/app/agent` AI Agent console (prompt builder)
- `/app/agent/prompts/[id]` prompt editor
- `/app/settings` settings

## Notes

- Credentials registration requires first name + last name + email + password.
- Credentials login uses email + password.
- Settings includes Integrations so credentials users can link Google login.
- Email and profile picture can be updated from Settings.
- When Google is linked/logged in, BlackDesk syncs first name, last name, email, and profile photo.
- Theme selector is available in Settings and the sidebar footer (light/dark/system).
- Users configure AI API keys in Settings, then choose provider/model from the AI Agent page.
- Agent Prompt generation (`/api/agent/generate`) uses `OPENAI_API_KEY` if set, otherwise falls back to a deterministic mock draft so the UI still works.
- AI Agent includes conversation history with multi-chat threads (rename/delete/new chat).
- Supported providers: OpenAI, Anthropic (Claude), Google (Gemini).
- Keys are encrypted at rest using `ENCRYPTION_SECRET` (or `NEXTAUTH_SECRET` fallback).
- Agent can create tasks/events automatically from chat input.
- If no working LLM key is available, the agent uses a limited fallback parser.
- All Calendar and Task operations are scoped by authenticated user ID.
- Passwords are hashed with bcryptjs (10 rounds).
- `/api/extract` is a stub endpoint for future AI extraction.

