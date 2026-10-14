-- Keep the public Data API closed until the Express authorization model exists.

alter table public.devices enable row level security;
alter table public.sensor_samples enable row level security;
alter table public.sensor_readings enable row level security;
alter table public.alert_events enable row level security;
alter table public.calibration_profiles enable row level security;
alter table public.device_health enable row level security;

-- No anon/authenticated policies are created intentionally. The future Express
-- backend will use a server-side credential and enforce application authorization.
-- Never place a service-role or secret key in firmware, frontend code, or SQL.

revoke all on table
    public.devices,
    public.sensor_samples,
    public.sensor_readings,
    public.alert_events,
    public.calibration_profiles,
    public.device_health
from anon, authenticated;
