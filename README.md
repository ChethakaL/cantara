# Cantara Dealflow Demo

A polished two-portal diligence platform demo for private equity workflows.

- Client portal: register via onboarding wizard, view document requests, upload files.
- Admin portal: view clients by stage (`Initial Review`, `In Progress`, `Completed`), issue requests, review uploads, connect Google Drive, choose parent folder location, and sync files.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS
- Prisma 7 + PostgreSQL
- Session auth (email/password, role-based routing)
- Google Drive API (OAuth client ID + client secret)

## 1. Environment

Create env file:

```bash
cp .env.example .env
```

Set at least:

- `DATABASE_URL`
- `DEMO_ADMIN_EMAIL`
- `DEMO_ADMIN_PASSWORD`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Google OAuth callback:

- `GOOGLE_REDIRECT_URI` defaults to `http://localhost:3000/api/admin/google-drive/callback`
- Add that exact URI to Google Cloud Console under:
  `APIs & Services -> Credentials -> OAuth 2.0 Client IDs -> Authorized redirect URIs`

## 2. Install and Generate Prisma Client

```bash
npm install
npm run prisma:generate
```

## 3. Apply Database Schema

```bash
npm run prisma:migrate -- --name init
```

## 4. Seed Admin User

```bash
npm run prisma:seed
```

## 5. Run

```bash
npm run dev
```

Open `http://localhost:3000`.

## Demo Flow

1. Admin signs in and opens `/admin`.
2. Admin clicks `Connect Google Drive`, authorizes, then selects a Drive folder location.
3. Client registers at `/register` and fills business profile.
4. Admin adds standard (`Business registration`, `Business plan`) or custom document requests.
5. Client uploads requested documents in `/client`.
6. Admin clicks `Save to Drive`; if the client has no folder yet, a new client folder is created inside the selected Drive location.

## Quality Checks

Validated locally:

- `npm run lint`
- `npm run build`

## Docker (VPS Deployment)

Build and run:

```bash
# Build
docker build -t cantara:latest .

# Run (pass env vars; e.g. port 3020 to avoid conflicts)
docker run -d \
  --name cantara \
  -p 127.0.0.1:3020:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e SESSION_SECRET="your-secret" \
  -e DEMO_ADMIN_EMAIL="admin@cantara.demo" \
  -e DEMO_ADMIN_PASSWORD="your-password" \
  cantara:latest
```

Migrations run automatically on container start when `DATABASE_URL` is set.

## Notes

- Uploaded files are stored locally in `storage/uploads`.
- No Google login is used for clients; OAuth is only for admin-side Drive syncing.
