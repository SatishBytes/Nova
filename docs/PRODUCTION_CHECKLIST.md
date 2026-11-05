# NOVA production checklist

This checklist is an operational starting point, not a substitute for review
of the production schema, privacy policy, or legal terms.

## Environments

- Maintain separate Supabase projects for development, test, and production.
- Point local development only at the development project.
- Point Playwright only at an isolated test project with disposable accounts and
  data. Disable email confirmation there if tests are expected to sign up and
  immediately sign in.
- Configure Vercel and Render production services only with production values.
- Keep service-role keys exclusively in Render/backend secrets. The frontend
  receives only the Supabase publishable/anon key.

## Environment variables

| Platform | Variable | Required | Purpose |
|---|---|---:|---|
| Vercel | `VITE_SUPABASE_URL` | Yes | Public Supabase project URL |
| Vercel | `VITE_SUPABASE_KEY` | Yes | Public Supabase publishable/anon key |
| Vercel | `VITE_API_URL` | Yes | Render API URL ending in `/api` |
| Vercel | `VITE_CAPTCHA_SITE_KEY` | No | Turnstile site key; CAPTCHA is off when empty |
| Vercel | `VITE_SENTRY_DSN` | No | Frontend Sentry DSN |
| Vercel | `VITE_SENTRY_SOURCE_MAPS` | No | Opt-in build source maps; does not itself upload them |
| Render | `SUPABASE_URL` | Yes | Supabase project URL |
| Render | `SUPABASE_KEY` | Yes | Supabase service-role key |
| Render | `FRONTEND_URL` | No | Additional comma-separated allowed CORS origins |
| Render | `PORT` | No | Render-provided port is used when present |
| Render | `SENTRY_DSN` | No | Backend Sentry DSN |
| Render | `AI_ENABLED` | No | Explicitly enable the optional AI endpoint |
| Render | `ANTHROPIC_API_KEY` | Conditional | Required only when AI is enabled |
| Render | `UPSTASH_REDIS_REST_URL` | No | Upstash Redis REST endpoint for shared rate limiting and short-lived response caching |
| Render | `UPSTASH_REDIS_REST_TOKEN` | No | Private Upstash Redis REST token |
| Render | `CACHE_ENABLED` | No | Defaults to enabled when Redis is configured; set to `false` to disable caching |
| Supabase Auth | Site URL / redirect URLs | Yes | Include the production origin and `/auth/callback` and `/reset-password` routes |
| Supabase Auth | CAPTCHA provider secret | Conditional | Configure the matching Turnstile secret when `VITE_CAPTCHA_SITE_KEY` is enabled |
| GitHub Actions | `E2E_TEST_EMAIL` | No | Disposable signup address for manual browser tests |
| GitHub Actions | `E2E_TEST_PASSWORD` | No | Password for the disposable test account |
| GitHub Actions | `VITE_SUPABASE_URL` | No | Dedicated test Supabase project URL |
| GitHub Actions | `VITE_SUPABASE_KEY` | No | Dedicated test project's public key |
| GitHub Actions | `VITE_API_URL` | No | Dedicated test backend URL ending in `/api` |

Never put `.env` files, service-role keys, or user credentials in the repository.

## Database migrations

1. Back up the target Supabase database and confirm the current schema before
   applying changes.
2. The checked-in migration directory does not include the base schema
   migration for projects/tasks/team_members. Verify that the expected base
   schema has already been applied.
3. Apply the available migrations in order: `002_tasks_upgrade.sql`,
   `003_collaboration.sql`, `004_productivity.sql`, then
   `006_production_hardening.sql`. Migration 005 is not present in this
   checkout. Do not skip earlier migrations when starting from an empty
   database.
4. Review the SQL and run each migration in a staging Supabase project first.
5. Run `supabase/tests/rls_checks.sql` with a role that can inspect catalogs,
   then perform the documented owner/member/viewer/outsider behavior checks
   using disposable authenticated users.
6. Verify foreign-key delete actions against the live schema before relying on
   cascades. The backend deletes owned project memberships and tasks before
   projects; task comments and subtasks depend on the existing task cascades.
7. Deploy the backend and frontend only after staging checks pass. Confirm
   `/health` and `/health/ready`, sign-in, project/task permissions, restore,
   and account export/deletion behavior.

The backend uses one long-lived Supabase JS client with service-role access.
Controllers must continue to enforce ownership and role checks because that
key bypasses RLS. Authentication calls Supabase Auth `getUser(token)` to
validate the token server-side and requires the `authenticated` audience; the
provider rejects expired or invalid signatures.

## Backups and restore

- Enable and verify Supabase's production backup/PITR plan appropriate to the
  project.
- Record who can initiate a restore and retain a runbook with the Supabase
  project reference, recovery point, and escalation contacts.
- Practice restoring into a separate project before relying on the procedure.
- After restore, verify RLS policies, auth configuration, indexes, migrations,
  and a sample owner/member/viewer access matrix.

## Key rotation

1. Create or rotate the key in the relevant provider; do not paste it into chat,
   logs, source control, or build output.
2. Update Render/Vercel/GitHub environment secrets in the correct environment.
3. Redeploy affected services and verify health/readiness and authentication.
4. Revoke the old key after the new configuration is confirmed.
5. If a service-role key may have leaked, rotate it immediately and review
   Supabase logs, Git history, and deployment logs.

## Security and operations

- Keep Vercel's CSP in Report-Only mode while validating Supabase realtime,
  PWA, fonts, and CAPTCHA traffic. Review browser reports, then switch the
  header key from `Content-Security-Policy-Report-Only` to
  `Content-Security-Policy` once the policy is verified.
- The app does not configure automatic Sentry source-map upload: the approved
  dependencies do not include a Sentry build/upload plugin. Source maps remain
  disabled unless `VITE_SENTRY_SOURCE_MAPS=true`; configure an approved upload
  mechanism before enabling this in production.
- Use `npm run test:e2e` from `frontend` against a dedicated test backend and
  Supabase project. Browser tests skip automatically when the E2E variables are
  missing. Install the Playwright browser with
  `npx playwright install chromium` when running locally.
- Render's free plan may take 30–60 seconds to wake after inactivity.
