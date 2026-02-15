# BlackDesk

BlackDesk is a black-theme personal productivity app built with Next.js App Router, Prisma, and NextAuth.

## Stack

- Next.js 14+ (App Router) + TypeScript
- Tailwind CSS
- Prisma ORM + SQLite (local dev)
- NextAuth (Credentials + Google OAuth)
- FullCalendar (month/week/day + drag/drop)

## Environment

Copy `.env.example` to `.env` and fill values:

```bash
DATABASE_URL="file:./dev.db"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-a-secret"
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
```

## Setup

1. `npm install`
2. `npx prisma migrate dev --name init`
3. `npm run dev`

Open `http://localhost:3000`.

## Google OAuth Setup

In Google Cloud Console, add this authorized redirect URI:

- `http://localhost:3000/api/auth/callback/google`

Then set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`.

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
- `/app/calendar` calendar
- `/app/tasks` tasks
- `/app/inbox` inbox dump
- `/app/settings` settings

## Notes

- All Calendar, Tasks, and Inbox operations are scoped by authenticated user ID.
- Passwords are hashed with bcryptjs (10 rounds).
- `/api/extract` is a stub endpoint for future AI extraction.

