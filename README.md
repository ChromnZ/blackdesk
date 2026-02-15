# BlackDesk

BlackDesk is a black-theme personal productivity app built with Next.js App Router, Prisma, and NextAuth.

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
3. `npm run db:push`
4. `npm run dev`

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

## Demo Seed (Optional)

Create a local demo credentials user:

- Username: `demo`
- Password: `demo1234`

Run:

```bash
npm run prisma:seed
```

## Key Routes

- `/` landing page
- `/auth/login` login
- `/auth/register` registration
- `/auth/complete-username` one-time username setup for new Google sign-ins
- `/app` dashboard home
- `/app/calendar` calendar
- `/app/tasks` tasks
- `/app/news` tabbed news section
- `/app/agent` AI agent chat
- `/app/settings` settings

## Notes

- Usernames are unique, lowercase, and locked after setup.
- Credentials registration requires email + username + password.
- New Google users are prompted to choose a permanent username before entering the app.
- Settings includes Integrations so credentials users can link Google login.
- Email and profile picture can be updated from Settings.
- When Google is linked/logged in, BlackDesk syncs Google email and profile photo.
- Users configure AI API keys in Settings, then choose provider/model from the AI Agent page.
- Supported providers: OpenAI, Anthropic (Claude), Google (Gemini).
- Keys are encrypted at rest using `ENCRYPTION_SECRET` (or `NEXTAUTH_SECRET` fallback).
- Agent can create tasks/events automatically from chat input.
- If no working LLM key is available, the agent uses a limited fallback parser.
- All Calendar and Task operations are scoped by authenticated user ID.
- Passwords are hashed with bcryptjs (10 rounds).
- `/api/extract` is a stub endpoint for future AI extraction.

