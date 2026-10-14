# Frontend

React/Vite private dashboard for the Smart Grain Spoilage Monitor.

## Run locally

```powershell
Copy-Item .env.example .env
npm run dev
```

Set `VITE_API_BASE_URL` to the Express backend origin. The dashboard authenticates through the backend and never receives Supabase service-role credentials or ESP32 ingestion tokens.

## Production build

```powershell
npm run build
npm run preview
```

The dashboard displays real API data only. If no device data exists, it shows an empty state with simulated-ingestion instructions.
