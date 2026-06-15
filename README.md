# Cantara Business Sale Readiness & M&A Advisory Portal

Built by **Babalilm AI FZ-LLC** for **Pollack Strategy Corp dba Cantara Pet Advisors**

---

## Overview

A full-stack Next.js portal that automates Cantara's client engagement workflow across two consulting workstreams and a complete M&A sale process. The admin portal replaces Monday.com entirely — all client provisioning, workstream assignment, and configuration is done inside the portal itself.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.local.example .env.local
# Edit .env.local — add your ANTHROPIC_API_KEY (required for lease analysis)

# 3. Run dev server
npm run dev
# → http://localhost:3000
```

### Demo credentials
- **Admin:** Click "Continue with Google (via Nylas)" — in dev mode (no Nylas keys set) this bypasses OAuth and logs you straight in
- **Client:** Any email + any password — loads the first provisioned client

---

## Architecture

### No Monday.com
Everything that previously required Monday.com is now native to the admin portal:

| Was Monday | Now admin portal |
|---|---|
| Workstream dropdown → triggers portal provisioning | Client Management tab → Workstream selector |
| Change client email/name | Client Management tab → Identity fields |
| Stage updates | Client Management tab → Stage selector |
| Multi-location flag | Client Management tab → Business Structure |
| Team member management | Client Management tab → Team Members section |
| Notes per client | Client Management tab → Internal notes |

### Route map
```
/                          Landing
/login/admin               Google sign-in via Nylas OAuth
/login/client              Email + password
/admin                     All clients, grouped by workstream
/admin/client/[id]         Full client detail — 5 tabs:
  ├── Client Management    Edit everything about a client
  ├── Documents            View document submission status
  ├── Lease Analysis       Upload PDFs → AI analysis
  ├── Additional Reqts     Flag items the client must action
  └── Messages             Team chat with client
/dashboard                 Client portal — 6 phases:
  ├── Overview             Process explainer
  ├── Valuation            Upload P&Ls first (always)
  ├── Assign               Yes/No per doc, then assign confirmed docs
  ├── Collection           Upload documents
  ├── Additional Reqts     See items flagged by advisor
  └── Roadmap              Final deliverable (post-analysis)

/api/lease-analysis        Anthropic API → full 5-part lease report
/api/extract-pdf           Server-side PDF text extraction
/api/chat                  Message persistence
/api/auth/nylas/connect    Start Nylas Google OAuth
/api/auth/nylas/callback   OAuth callback → session + Drive access
/api/drive/create-folder   Create a named client Drive folder inside an admin-selected parent folder
```

---

## Key Features

### Lease Analysis Agent
- Upload base lease + all amendments/riders as separate PDFs
- Server-side text extraction → sent to Claude Sonnet at temperature 0
- Full 5-part report parsed into tabs:
  - **Snapshot** — all key fields in a table with section citations
  - **Findings** — section-by-section analysis (§2.1 through §2.18)
  - **Flags** — 🔴 Red / 🟡 Orange / 🟢 Green with source citations and recommended actions
  - **Checklist** — M&A transaction checklist with interactive checkboxes
  - **Documents** — inventory of all provided documents + missing items
- Export to Markdown

### Client Portal UX (from meeting transcript)
- **Valuation first**: P&L uploads are a standalone first stage for all workstreams
- **Assign tab** (renamed from "Preparation"): Step 1 = Yes/No per document, Step 2 = assign only confirmed docs to team members. Green checkmark only appears when all confirmed docs are assigned.
- **Additional Requirements** tab (not "Follow-up" or "Review") — action-oriented language
- **No "AI" anywhere** in client-facing UI
- **Multi-location / parent company** mode: shareholders agreement at parent level, financials/leases/licenses per branch
- **Workstream provisioning** from admin side → controls which documents client sees
- **Chat widget**: bottom-right floating button, admin team chat (Slack-style), client gets email notification badge

### Google Drive Integration
- Admin signs in with Google from the admin dashboard
- Client Management stores a selected Drive folder URL on each client record
- Admins can either paste an existing client folder URL/ID or create a named folder inside a parent folder they choose
- Drive sync uploads documents and generated reports only for clients with an assigned Drive folder

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ Yes | For lease analysis agent |
| `NYLAS_CLIENT_ID` | Optional | For Google OAuth via Nylas |
| `NYLAS_CLIENT_SECRET` | Optional | For Google OAuth via Nylas |
| `NYLAS_API_KEY` | Optional | For Nylas API calls |
| `NYLAS_API_URI` | Optional | Default: `https://api.us.nylas.com` |
| `NEXTAUTH_URL` | Optional | Default: `http://localhost:3000` |
| `NEXTAUTH_SECRET` | Optional | For session signing |

All Nylas variables are optional — the portal runs in demo mode without them.

---

## Data Layer

Currently uses `localStorage` for all state (clients, messages, requirements, lease analyses). This makes the portal fully functional for demos and development without a backend.

**To move to production:**
1. Replace the functions in `src/lib/store.ts` with database calls (Supabase recommended)
2. Add a `DATABASE_URL` to `.env.local`
3. The rest of the codebase doesn't need to change — the store interface is the abstraction layer

Recommended schema:
```sql
clients, chat_messages, additional_requirements, lease_analyses
```

---

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS v3 + custom CSS variables
- **Animation**: Framer Motion
- **Icons**: Lucide React
- **AI**: Anthropic Claude Sonnet (lease analysis, temperature 0)
- **Auth**: Nylas OAuth → Google
- **Drive**: Google Drive API v3 (via Nylas grant token)
- **PDF extraction**: Server-side binary parsing (`/api/extract-pdf`)

---

## Production Deployment

```bash
npm run build
npm start
```

Deploy to Vercel (recommended):
```bash
npx vercel --prod
```
Set all environment variables in the Vercel dashboard. The `maxDuration = 300` on the lease analysis route requires a Pro plan for the full timeout.

---

*Cantara Business Sale Readiness & M&A Advisory Portal v1.0*  
*© 2026 Pollack Strategy Corp dba Cantara Pet Advisors*  
*Developed by Babalilm AI FZ-LLC*
