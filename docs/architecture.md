# Planned Architecture

This is a design baseline. Firmware preparation, version-controlled database migrations, and a minimal Express ingestion scaffold are present; the dashboard and hosted deployment remain unimplemented.

## Data flow

```text
ESP32 sensors
    |
    +--> local reading validation and local warning rules
    |       +--> buzzer on GPIO 25
    |       +--> servo on GPIO 27
    |
    +--> HTTPS request when Wi-Fi is available
            |
            +--> Node.js/Express API
                    |
                    +--> Supabase PostgreSQL
                            |
                            +--> React/Vite private dashboard
```

## ESP32 responsibilities

- Read the confirmed sensors using the original sketch as the behavior baseline.
- Preserve local buzzer and servo warning behavior when Wi-Fi or the backend is unavailable.
- Keep raw readings separate from future calibrated values and derived risk classifications.
- Mark failed or unavailable readings explicitly; never substitute fake values.
- Attach device identity, firmware version, sequence number, measurement time, and reading quality to transmitted samples.
- Use HTTPS with certificate verification for remote communication.

The original sketch is preserved at `firmware/legacy/original-sketch.ino`. The separate sensor-acquisition implementation is under `firmware/esp32-monitor/` and must be reviewed before further firmware work.

## Express API responsibilities

- Validate request shape, device identity, sequence numbers, sensor names, and reading quality.
- Authenticate devices without exposing device secrets in frontend code.
- Apply idempotent ingestion for retried samples.
- Store server receipt time separately from device measurement time.
- Provide latest readings, historical readings, health, and alert-history endpoints.
- Keep Supabase service-role credentials server-side only.

## Supabase responsibilities

The planned database will separate:

- Devices and device health
- Collection samples
- Individual raw/calibrated sensor readings
- Alert events
- Future calibration profiles

Publicly exposed tables will require reviewed Row Level Security policies. The first implementation should use local development and migrations before any hosted Supabase configuration.

## React/Vite dashboard responsibilities

- Provide private single-user login as the initial dashboard assumption.
- Display latest readings with units and quality/status information.
- Display historical charts using stored readings only.
- Display alert history and device health.
- Distinguish sensor failure, missing data, and warning conditions.
- Never include Supabase service-role or secret keys in browser code.

## Planned API surface

- `GET /health/live`
- `GET /health/ready`
- `POST /api/v1/ingest`
- `GET /api/v1/devices`
- `GET /api/v1/devices/:deviceId/latest`
- `GET /api/v1/devices/:deviceId/readings`
- `GET /api/v1/devices/:deviceId/health`
- `GET /api/v1/devices/:deviceId/alerts`

Exact authentication and authorization behavior will be implemented after the original firmware and hardware checks are reviewed.
