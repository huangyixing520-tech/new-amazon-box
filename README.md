# Mercato

Mercato turns a product image into marketplace image sets, product videos, and
Amazon Listing content.

## Product architecture

- `app/`: public Mercato web app and server routes
- Google Identity Services: user sign-in
- Cloudflare D1/R2 on Sites, or SQLite plus a persistent filesystem volume on
  Railway: user profiles, encrypted API-key metadata, task ownership, and
  generated assets
- `task-backend/`: persistent Railway worker for asynchronous image jobs
- Dola-compatible API: LLM, image, and video model gateway

Every user supplies their own model API key in the account panel. The key is
encrypted at rest with `API_KEY_ENCRYPTION_SECRET`; the browser receives only
its last four characters. Image jobs pass the current user's key to the private
task service over TLS, where it is encrypted while queued with
`USER_KEY_ENCRYPTION_SECRET`.

## Local development

Requires Node.js `>=22.13.0`.

```bash
npm install
cp .env.example .env.local
npm run dev
```

The D1 and R2 bindings are declared in `.openai/hosting.json`. When those
bindings are unavailable (local production or Railway), Mercato automatically
uses SQLite and local object storage under `MERCATO_DATA_DIR`.

## Required production configuration

The web site requires:

- `GOOGLE_CLIENT_ID`
- `SESSION_SECRET`
- `API_KEY_ENCRYPTION_SECRET`
- `TASK_BACKEND_URL`
- `TASK_BACKEND_TOKEN`

For a public Railway deployment, mount a persistent volume at `/data` and set
`MERCATO_DATA_DIR=/data`. `railway.json` contains the production build, start,
health-check, and restart policy.

The Railway task service requires:

- `TASK_BACKEND_TOKEN`
- `USER_KEY_ENCRYPTION_SECRET`
- a persistent volume mounted at `/data` with `DATA_DIR=/data`

See `.env.example` and `task-backend/README.md` for the remaining model
defaults.

## Operations dashboard

Administrators listed in `ADMIN_EMAILS` can open `/admin`. The dashboard uses
the authenticated product user ID as the stable UID and stores one generation
record for every image or video result slot. The global generation search
combines date range, exact UID, exact generation ID, and Prompt text; media,
status, and Skill can be added to the same query.

The overview reports the ordered login/page-entry → generation request →
generation success → export funnel, per-Skill result-slot funnels, daily image
and video completions, DAU, rolling 30-day MAU, DAU export rate, latency P50/P95,
and grouped failures. Success, failure, and download events are written by
server routes rather than accepted from the browser. Existing assets remain
searchable after the additive `0003_generation_observability.sql` migration;
new assets also keep their authoritative provider generation ID.

## Verification

```bash
npm run db:generate
npm run build
npm test
```

`npm run db:generate` must be run and the resulting migration inspected after
identity or ownership schema changes.
