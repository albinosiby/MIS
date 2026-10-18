# Deploy School MIS on Railway

The application runs as two Node.js 24 services. The web service serves Next.js; the worker processes queued reports, reminders and scheduled work without an open browser. Both use the existing Supabase project for Auth, database and private documents. No Railway database or persistent volume is required in Supabase mode.

## 1. Upload the repository

Push this project to your GitHub repository and connect it to Railway. Include `package-lock.json`, `public/`, `scripts/`, `src/` and `.railway/`. Keep `.env.local`, `.local/`, `node_modules/`, `.next/` and Supabase access tokens out of Git. The supplied `.gitignore` and `.railwayignore` exclude local credentials, generated files and local database files.

## 2. Create two services

The simplest dashboard setup is to connect the same repository twice and use these settings. Root directory is the project root for both services.

| Setting             | web                     | worker                                      |
| ------------------- | ----------------------- | ------------------------------------------- |
| Builder             | Railpack                | Railpack                                    |
| Build command       | `npm run build`         | `node --check scripts/run-school-worker.ts` |
| Start command       | `npm run start:railway` | `npm run worker:railway`                    |
| Healthcheck path    | `/api/health`           | None                                        |
| Healthcheck timeout | 120 seconds             | None                                        |
| Replicas            | 1                       | 1                                           |
| Restart policy      | On failure, 10 retries  | Always                                      |
| Serverless/sleep    | Disabled                | Disabled                                    |
| Public domain       | Generate a domain       | None                                        |

Node 24 is selected by `package.json`. The web process binds to `0.0.0.0` and uses Railway's supplied `PORT`; do not hardcode a port. The worker is a continuous service, not a Railway cron job. Its build does not need the Next.js output.

### Optional: apply the settings from code

The same settings are in `.railway/railway.ts`, using the pinned official `railway/iac` SDK. Railway's Infrastructure as Code configuration must be applied explicitly; simply pushing this file does not apply it. Current new-service configuration uses IaC rather than the deprecated `railway.json` format.

With the Railway CLI installed, run from this folder:

```sh
npm ci
railway login
railway link
railway config plan
railway config apply
```

Choose the intended project/environment when linking. Review the plan before applying, particularly for a project with existing resources. This definition creates `web` and `worker` without a repository source because your repository identity is not known here. Connect the repository to each service afterward. Create the shared variables below before deploying. You can instead use the dashboard table above without applying IaC.

## 3. Set environment variables before building

For dashboard setup, add these variables to **both services**. For IaC setup, add the three `NEXT_PUBLIC_*` entries, `SUPABASE_SERVER_SECRET_KEY` and `MIS_TEST_ACCOUNTS_ENABLED` as project shared variables; the configuration references these five shared entries and supplies the other three constants.

```dotenv
NODE_ENV=production
MIS_BACKEND=supabase
NEXT_TELEMETRY_DISABLED=1
NEXT_PUBLIC_SUPABASE_URL=https://fxtlcapsytqyzsgcbcvp.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your existing publishable key>
SUPABASE_SERVER_SECRET_KEY=<your existing server secret key>
NEXT_PUBLIC_APP_URL=https://<your-web-domain>.up.railway.app
MIS_TEST_ACCOUNTS_ENABLED=true
```

Copy the keys privately from your existing configuration into Railway Variables. The server key must be a Supabase secret key (`sb_secret_…`) or legacy service-role JWT, never a Supabase management/access token (`sbp_…`). Keep its variable name exactly as shown; never prefix it with `NEXT_PUBLIC_`.

`true` allows your existing synthetic `@greenfield.test` accounts while testing this school. Set it to `false` for a real school environment. Use only the origin for `NEXT_PUBLIC_APP_URL`, with HTTPS and no path. Generate the web domain first, then set this value and deploy. Public variables are embedded during the Next.js build: changing them requires rebuilding the web service.

No `DATABASE_URL`, local session secret, seed command or automatic migration command is required for the existing connected Supabase project. Deployment must not reseed or reset it. Future schema migrations should be reviewed and applied separately before code that depends on them is deployed.

## 4. Configure Supabase Auth

In Supabase → Authentication → URL Configuration:

- Set **Site URL** to your web HTTPS origin.
- Add `https://<your-web-domain>.up.railway.app/auth/confirm` to **Redirect URLs** for the recovery callback.
- If using a custom domain, use that origin consistently in Railway and Supabase.

Keep your localhost redirect if you still develop locally. External email/SMS/WhatsApp providers and payment gateway remain separate configurations; hosting does not enable them.

## 5. Deploy and verify

Deploy both services after saving variables. Web logs should show `Deployment configuration verified for web`; worker logs should show the corresponding worker message. Missing/invalid configuration stops startup with a safe error rather than silently falling back to temporary local storage.

1. Open `/api/health` without signing in: expect HTTP 200 and `{"status":"ok"}`. This is process liveness, not a database readiness check.
2. Sign in with each existing role account, refresh a protected page and sign out. Check that a forbidden role page remains blocked.
3. Save a school record and verify it persists after refresh and another login.
4. Upload a private document, download it as an authorized user and verify an unrelated role cannot access it.
5. Queue a report and download the result. Close the browser and verify scheduled jobs still run through the worker.
6. Test password recovery after configuring email delivery and the callback URL.

Review both services' logs for failed jobs and authentication errors. Keep Supabase database backups enabled and confirm the required retention/restore plan for the school's data. Railway's startup healthcheck is not continuous uptime monitoring; add monitoring for the public endpoint and queued job failures as part of operations.

## Local verification and rollback

```sh
npm test
npm run typecheck
npm run build
```

These check the code and configuration; only deploying to your account verifies Railway infrastructure. Redeploy the previous successful Railway deployment to roll back application code. Database migrations require their own reviewed recovery plan; reverting code does not revert database changes.

References: [Railway IaC](https://docs.railway.com/infrastructure-as-code), [healthchecks](https://docs.railway.com/deployments/healthchecks), [Railpack Node](https://railpack.com/languages/node), [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).
