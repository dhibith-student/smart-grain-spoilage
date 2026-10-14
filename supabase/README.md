# Supabase database design

Version-controlled database design for the Smart Grain Spoilage Monitor. The migrations are authored but have not been applied to a local or hosted Supabase project in this iteration.

## Migration order

1. `migrations/20261014000000_initial_schema.sql` creates the six tables, constraints, foreign keys, and indexes.
2. `migrations/20261014000100_security.sql` enables RLS and revokes table privileges from `anon` and `authenticated`.

## Schema decisions

- `devices` stores identity, name, optional grain type, enabled state, and last-seen time.
- `sensor_samples` stores one collection cycle. `(device_id, device_sequence_no)` is unique for safe retries; strict sequence ordering remains a backend responsibility.
- `sensor_readings` stores one value per sensor type. DHT11 produces `temperature_c` and `humidity_percent`; the other types are `moisture_raw_adc`, `gas_raw_adc`, `light_lux`, and `sound_raw_adc`.
- `alert_events` stores local/derived alert history. The buzzer and servo are local actuators and do not require reading rows.
- `calibration_profiles` stores future versioned parameters without seeding calibration values.
- `device_health` stores the latest device status as a one-to-one extension of `devices`.

Raw readings and optional calibrated readings are separate. Valid quality states are `ok`, `error`, `unavailable`, `out_of_range`, and `stale`. An `ok` reading requires a numeric raw value; non-ok readings require an error code and may have a null numeric value.

## Security model

RLS is enabled on every table and no `anon` or `authenticated` policies are created. This prevents direct public Data API access until the future Express authentication and private-dashboard authorization model is reviewed. The future backend may use a server-side service-role credential; it must never be placed in firmware, frontend code, migrations, or examples.

`devices.device_key` is an identity value, not a secret. Device authentication and secret-token storage are deferred to the backend design.

## Simulated example

[`examples/simulated-ingest-payload.json`](examples/simulated-ingest-payload.json) is documentation-only. Its values are simulated and are not physical sensor data or calibration evidence.

## Local migration instructions

The repository currently has `supabase/migrations/` but no `supabase/config.toml`, so the Supabase CLI project configuration is not initialized here. This project uses the existing CLI through `npx`; Docker and a local Supabase stack are not required for the hosted-only workflow.

```powershell
npx supabase --version
npx supabase --help
```

Do not run `npx supabase init` for the hosted-only workflow unless you specifically need a local CLI configuration file. If you do initialize later, do not use an overwrite option and preserve the existing migration files.

## Hosted migration procedure

After reviewing the migrations and confirming the target project reference:

```powershell
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase migration list
npx supabase db push --linked
npx supabase migration list
```

Do not run `db reset --linked`; it is destructive. `db push --linked` is the only application command in this procedure and must be run manually after reviewing migration status. No hosted migration has been performed here.

## Local-only test file

The pgTAP test requires a local Supabase stack, which this project intentionally does not use. Do not run it as part of the hosted-only workflow. If local testing is enabled in a separate environment later, run:

```powershell
npx supabase test db --local
```

The test file is intentionally written for `supabase test db`; it is not a raw SQL script to execute with `db query`. Do not use real credentials in repository files.
