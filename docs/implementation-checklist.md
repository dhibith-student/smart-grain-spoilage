# Implementation Checklist

## Foundation

- [x] Preserve the existing `ESIOT.pdf` file.
- [x] Initialize Git because no repository existed.
- [x] Add the confirmed hardware inventory and pin map.
- [x] Record and preserve the original sketch.
- [x] Add secret and generated-file exclusions.
- [x] Preserve the unchanged original sketch at `firmware/legacy/original-sketch.ino`.
- [ ] Review this foundation before implementation.

## Hardware and firmware

- [ ] Identify the exact ESP32 board.
- [ ] Identify the exact microphone module.
- [ ] Verify analog-output voltage compatibility for GPIO 32, GPIO 33, and GPIO 35.
- [ ] Verify BH1750 supply, I2C address, and pull-ups.
- [ ] Verify buzzer drive requirements.
- [ ] Verify separate servo power, common ground, and mechanical limits.
- [ ] Preserve and test the original local buzzer/servo behavior.
- [x] Create a separate sensor-acquisition firmware implementation.
- [x] Organize acquisition, validation, threshold evaluation, buzzer, and servo functions.
- [x] Add explicit failed-reading states for DHT11 and BH1750.
- [x] Keep moisture, MQ-135, and microphone values raw-only.
- [x] Replace the blocking sampling delay with a `millis()` schedule.
- [ ] Add sequence numbers, device identity, and HTTPS transport.
- [ ] Verify local alerts continue without Wi-Fi on physical hardware.

## Database

- [x] Choose and document the imperative local Supabase migration workflow.
- [x] Create ordered migrations for devices, samples, readings, health, alerts, and calibration profiles.
- [x] Add uniqueness for device sequence numbers to support idempotent retries.
- [x] Add sensor type, quality status, acknowledgement, and timestamp constraints.
- [x] Enable and review Row Level Security on exposed tables.
- [x] Avoid broad anonymous/authenticated access until the backend authorization model exists.
- [x] Add transactional SQL checks for duplicate samples, invalid quality, foreign keys, and null readings.
- [x] Add simulated payload documentation without seeding readings.
- [ ] Verify migrations locally before hosted setup.
- [x] Document service-role separation; no credentials are stored in the repository.

## Backend

- [x] Create the minimal Node.js/Express service scaffold.
- [x] Add environment validation without committing secrets.
- [x] Implement a liveness endpoint.
- [x] Implement header-authenticated sample ingestion.
- [x] Validate payload versions, ranges, quality states, and sequence numbers.
- [x] Handle duplicate device sequence submissions safely.
- [x] Implement latest, history, health, and alert endpoints.
- [x] Add structured error handling and safe logging.

## Dashboard

- [x] Create the React/Vite application.
- [x] Implement private single-user login through the Express API.
- [x] Display latest readings and quality states.
- [x] Add historical charts.
- [x] Add alert history and device health.
- [x] Implement loading, empty, stale, offline, and error states.
- [x] Confirm no secret keys are shipped to the browser.

## Testing

- [ ] Add firmware unit tests for parsing, validation, and local rule evaluation where feasible.
- [x] Add backend unit and integration tests with a mocked database.
- [ ] Add frontend component and data-state tests.
- [ ] Add end-to-end tests using controlled, non-fabricated test fixtures.
- [ ] Test duplicate ingestion and network interruption behavior.
- [ ] Perform hardware-in-the-loop validation when the physical system is available.

## Deployment

- [x] Document Render environment variables without storing values.
- [x] Document Vercel environment variables without storing values.
- [ ] Configure Supabase only after local schema and API validation.
- [ ] Configure HTTPS, CORS, logging, and health checks.
- [ ] Deploy only after local and integration tests pass.
