# Backend

Minimal Node.js/Express ingestion service for the confirmed ESP32 payload contract.

## Endpoints

- `GET /health/live` returns a process liveness response.
- `POST /api/v1/ingest` authenticates the device, validates the payload, inserts one `sensor_samples` row and its `sensor_readings`, and updates device health.
- `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, and `GET /api/v1/auth/me` provide the private dashboard session.
- `GET /api/v1/devices` lists devices and health.
- `GET /api/v1/devices/:deviceId/latest` returns the latest value for each sensor type.
- `GET /api/v1/devices/:deviceId/readings` returns filtered history using `from`, `to`, `sensor`, and `limit` query parameters.
- `GET /api/v1/devices/:deviceId/alerts` returns filtered alert history.

The ingestion endpoint expects `x-device-key` and `x-device-token` headers. Device tokens are supplied through the server-only `DEVICE_TOKENS_JSON` environment variable. The migration currently treats `devices.device_key` as an identity, so this mapping is intentionally kept outside the database for the short academic demonstration.

## Local setup

No packages have been installed in this iteration. From `backend/`, create a local `.env` based on `.env.example`, then run:

```powershell
npm install
npm start
```

`SUPABASE_SERVICE_ROLE_KEY` is server-only. Never place it in firmware, frontend code, Git, or request logs.

## Example request

Use the documentation-only payload at `supabase/examples/simulated-ingest-payload.json` only after replacing its simulated identity and values with an approved test payload. Do not represent it as physical sensor data.

```powershell
Invoke-RestMethod `
  -Uri http://localhost:3000/api/v1/ingest `
  -Method Post `
  -Headers @{
    'x-device-key' = 'esp32-grain-01'
    'x-device-token' = 'local-device-token'
  } `
  -ContentType 'application/json' `
  -Body (Get-Content '..\supabase\examples\simulated-ingest-payload.json' -Raw)
```

The service has not been connected to the hosted Supabase project in this iteration. Tests use a mocked database client.
