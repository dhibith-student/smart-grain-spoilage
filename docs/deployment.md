# Local and hosted runbook

The application uses one Express service between the browser/ESP32 and Supabase. Docker, WSL, Firebase, and a local Supabase stack are not required.

## Local backend

From `backend/`:

```powershell
Copy-Item .env.example .env
# Edit .env with local values. Never commit it.
npm start
```

Required backend variables are `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DEVICE_TOKENS_JSON`, `DASHBOARD_USERNAME`, `DASHBOARD_PASSWORD`, and `CORS_ORIGINS`. The service-role key and device token map are server-only.

## Local frontend

From `frontend/`:

```powershell
Copy-Item .env.example .env
npm run dev
```

Set `VITE_API_BASE_URL=http://localhost:3000` in `frontend/.env`. The frontend must never contain the Supabase service-role key or an ESP32 ingestion token.

## Simulated ingestion

After creating a matching device row in the hosted database and configuring the backend token map, send the documentation payload with the backend README's request example. The payload in `supabase/examples/simulated-ingest-payload.json` is simulated and must not be presented as physical sensor data.

## Render backend

Create a Render Web Service with root directory `backend`, build command `npm install`, and start command `npm start`. Configure `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DEVICE_TOKENS_JSON`, `DASHBOARD_USERNAME`, `DASHBOARD_PASSWORD`, and `CORS_ORIGINS=https://YOUR_VERCEL_DOMAIN`. Render supplies `PORT`; the backend listens on `process.env.PORT`.

## Vercel frontend

Create a Vercel project with root directory `frontend`, build command `npm run build`, and output directory `dist`. Configure `VITE_API_BASE_URL=https://YOUR_RENDER_DOMAIN`. Update Render's `CORS_ORIGINS` to the final Vercel origin. Do not configure any Supabase secret or service-role variable in Vercel.

## Database

Apply the existing migrations to the hosted project separately using the reviewed Supabase CLI procedure. Do not reset the hosted database. The backend can be built and tested with mocks before migration application.
