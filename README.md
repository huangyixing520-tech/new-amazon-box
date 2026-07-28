# Mercato

Mercato turns a product image into marketplace image sets, product videos, and
Amazon Listing content.

## Product architecture

- `app/`: public Mercato web app and server routes
- Google Identity Services: user sign-in
- Cloudflare D1: user profiles, encrypted API-key metadata, task ownership, and
  asset ownership
- Cloudflare R2: generated image and video files
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

The D1 and R2 bindings are declared in `.openai/hosting.json`. Local bindings
are simulated by the project Vite configuration.

## Required production configuration

The web site requires:

- `GOOGLE_CLIENT_ID`
- `SESSION_SECRET`
- `API_KEY_ENCRYPTION_SECRET`
- `TASK_BACKEND_URL`
- `TASK_BACKEND_TOKEN`

The Railway task service requires:

- `TASK_BACKEND_TOKEN`
- `USER_KEY_ENCRYPTION_SECRET`
- a persistent volume mounted at `/data` with `DATA_DIR=/data`

See `.env.example` and `task-backend/README.md` for the remaining model
defaults.

## Verification

```bash
npm run db:generate
npm run build
npm test
```

`npm run db:generate` must be run and the resulting migration inspected after
identity or ownership schema changes.
