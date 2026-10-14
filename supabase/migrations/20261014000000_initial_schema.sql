-- Smart Grain Spoilage Monitor initial relational schema.
-- No credentials, seed readings, calibration constants, or spoilage thresholds.

create extension if not exists pgcrypto;

create table public.devices (
    id uuid primary key default gen_random_uuid(),
    device_key text not null unique,
    name text not null,
    grain_type text,
    enabled boolean not null default true,
    last_seen_at timestamptz,
    created_at timestamptz not null default now(),
    constraint devices_device_key_not_blank check (btrim(device_key) <> ''),
    constraint devices_name_not_blank check (btrim(name) <> ''),
    constraint devices_grain_type_not_blank check (grain_type is null or btrim(grain_type) <> '')
);

comment on table public.devices is
    'Registered ESP32 devices. device_key is an identity value, not a device secret.';
comment on column public.devices.grain_type is
    'Optional configurable grain type; no universal grain rule is implied.';

create table public.sensor_samples (
    id uuid primary key default gen_random_uuid(),
    device_id uuid not null references public.devices(id) on delete restrict,
    device_sequence_no bigint not null,
    measured_at timestamptz,
    received_at timestamptz not null default now(),
    firmware_version text,
    payload_version text not null,
    wifi_rssi smallint,
    constraint sensor_samples_sequence_nonnegative check (device_sequence_no >= 0),
    constraint sensor_samples_payload_version_not_blank check (btrim(payload_version) <> ''),
    constraint sensor_samples_firmware_version_not_blank check (
        firmware_version is null or btrim(firmware_version) <> ''
    ),
    constraint sensor_samples_wifi_rssi_range check (
        wifi_rssi is null or wifi_rssi between -127 and 0
    ),
    constraint sensor_samples_device_sequence_unique unique (device_id, device_sequence_no),
    constraint sensor_samples_id_device_unique unique (id, device_id)
);

comment on column public.sensor_samples.device_sequence_no is
    'ESP32 sequence value. Uniqueness makes retried ingestion idempotent; backend validates ordering.';
comment on column public.sensor_samples.measured_at is
    'Optional device-provided measurement time. received_at is server time.';

create table public.sensor_readings (
    id uuid primary key default gen_random_uuid(),
    sample_id uuid not null,
    device_id uuid not null references public.devices(id) on delete restrict,
    sensor_type text not null,
    raw_value numeric,
    calibrated_value numeric,
    unit text,
    quality_status text not null default 'ok',
    error_code text,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    constraint sensor_readings_sample_device_fk foreign key (sample_id, device_id)
        references public.sensor_samples(id, device_id) on delete cascade,
    constraint sensor_readings_sensor_type_valid check (
        sensor_type in (
            'temperature_c', 'humidity_percent', 'moisture_raw_adc',
            'gas_raw_adc', 'light_lux', 'sound_raw_adc'
        )
    ),
    constraint sensor_readings_quality_status_valid check (
        quality_status in ('ok', 'error', 'unavailable', 'out_of_range', 'stale')
    ),
    constraint sensor_readings_metadata_object check (jsonb_typeof(metadata) = 'object'),
    constraint sensor_readings_quality_consistency check (
        (quality_status = 'ok' and raw_value is not null and error_code is null)
        or
        (quality_status <> 'ok' and error_code is not null and btrim(error_code) <> '')
    ),
    constraint sensor_readings_sample_sensor_unique unique (sample_id, sensor_type)
);

comment on column public.sensor_readings.raw_value is
    'Unmodified sensor-domain value, including raw ADC values where applicable.';
comment on column public.sensor_readings.calibrated_value is
    'Optional future calibrated value; this schema does not define calibration parameters.';
comment on column public.sensor_readings.quality_status is
    'Explicit quality. Failed readings use a non-ok status and may have null numeric values.';

create table public.alert_events (
    id uuid primary key default gen_random_uuid(),
    device_id uuid not null references public.devices(id) on delete restrict,
    sample_id uuid,
    alert_type text not null,
    severity text not null,
    trigger_value numeric,
    threshold_reference text,
    started_at timestamptz not null default now(),
    ended_at timestamptz,
    acknowledgement_status text not null default 'unacknowledged',
    acknowledged_at timestamptz,
    created_at timestamptz not null default now(),
    constraint alert_events_sample_device_fk foreign key (sample_id, device_id)
        references public.sensor_samples(id, device_id) on delete restrict,
    constraint alert_events_alert_type_valid check (
        alert_type in ('high_temperature', 'high_humidity', 'high_gas_raw_adc', 'sensor_error', 'system')
    ),
    constraint alert_events_severity_valid check (severity in ('info', 'warning', 'critical')),
    constraint alert_events_ack_status_valid check (
        acknowledgement_status in ('unacknowledged', 'acknowledged')
    ),
    constraint alert_events_end_after_start check (ended_at is null or ended_at >= started_at),
    constraint alert_events_ack_consistency check (
        (acknowledgement_status = 'unacknowledged' and acknowledged_at is null)
        or
        (acknowledgement_status = 'acknowledged' and acknowledged_at is not null)
    )
);

create table public.calibration_profiles (
    id uuid primary key default gen_random_uuid(),
    device_id uuid references public.devices(id) on delete cascade,
    sensor_type text not null,
    profile_version text not null,
    parameters jsonb not null,
    effective_at timestamptz not null,
    created_at timestamptz not null default now(),
    constraint calibration_profiles_sensor_type_valid check (
        sensor_type in (
            'temperature_c', 'humidity_percent', 'moisture_raw_adc',
            'gas_raw_adc', 'light_lux', 'sound_raw_adc'
        )
    ),
    constraint calibration_profiles_version_not_blank check (btrim(profile_version) <> ''),
    constraint calibration_profiles_parameters_object check (jsonb_typeof(parameters) = 'object'),
    constraint calibration_profiles_scope_version_unique unique (device_id, sensor_type, profile_version)
);

comment on column public.calibration_profiles.device_id is
    'Null means a future profile may be shared; non-null scopes it to one device.';
comment on column public.calibration_profiles.parameters is
    'Versioned calibration configuration supplied later; no values are seeded here.';

create table public.device_health (
    device_id uuid primary key references public.devices(id) on delete cascade,
    latest_successful_sample_at timestamptz,
    latest_ingestion_at timestamptz,
    firmware_version text,
    last_error text,
    updated_at timestamptz not null default now(),
    constraint device_health_firmware_version_not_blank check (
        firmware_version is null or btrim(firmware_version) <> ''
    )
);

create index sensor_samples_device_received_idx on public.sensor_samples (device_id, received_at desc);
create index sensor_samples_device_measured_idx on public.sensor_samples (device_id, measured_at desc)
    where measured_at is not null;
create index sensor_readings_device_created_idx on public.sensor_readings (device_id, created_at desc);
create index sensor_readings_sample_idx on public.sensor_readings (sample_id);
create index sensor_readings_device_type_created_idx
    on public.sensor_readings (device_id, sensor_type, created_at desc);
create index alert_events_device_started_idx on public.alert_events (device_id, started_at desc);
create index alert_events_unacknowledged_idx on public.alert_events (device_id, started_at desc)
    where acknowledgement_status = 'unacknowledged';
create index calibration_profiles_lookup_idx
    on public.calibration_profiles (device_id, sensor_type, effective_at desc);
create index device_health_updated_idx on public.device_health (updated_at desc);
