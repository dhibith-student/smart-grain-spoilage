-- pgTAP checks for the initial schema.
-- Run with: supabase test db --local
-- Supabase wraps each test file in a transaction; no rows persist.

select plan(6);

create temporary table _schema_test_context (
    device_id uuid not null,
    sample_id uuid not null
) on commit drop;

insert into public.devices (device_key, name)
values ('schema-test-device', 'Schema test device');

insert into public.sensor_samples (device_id, device_sequence_no, payload_version)
select id, 1, '1'
from public.devices
where device_key = 'schema-test-device';

insert into _schema_test_context (device_id, sample_id)
select d.id, s.id
from public.devices d
join public.sensor_samples s on s.device_id = d.id
where d.device_key = 'schema-test-device'
  and s.device_sequence_no = 1;

select is(
    (select count(*)::integer from _schema_test_context),
    1,
    'test device and sample can be created'
);

insert into public.sensor_readings (
    sample_id, device_id, sensor_type, raw_value, unit, quality_status, error_code
)
select sample_id, device_id, 'moisture_raw_adc', null, 'adc_counts', 'error', 'sensor_read_failed'
from _schema_test_context;

select is(
    (
        select count(*)::integer
        from public.sensor_readings r
        join _schema_test_context c
          on c.sample_id = r.sample_id and c.device_id = r.device_id
        where r.sensor_type = 'moisture_raw_adc'
          and r.raw_value is null
          and r.quality_status = 'error'
    ),
    1,
    'failed readings allow an explicit null raw value'
);

select throws_ok(
    $$
        insert into public.sensor_samples (device_id, device_sequence_no, payload_version)
        select device_id, 1, '1' from _schema_test_context
    $$,
    '23505',
    'duplicate device sequence is rejected'
);

select throws_ok(
    $$
        insert into public.sensor_readings (
            sample_id, device_id, sensor_type, raw_value, quality_status
        )
        select sample_id, device_id, 'light_lux', 10, 'not-a-quality-state'
        from _schema_test_context
    $$,
    '23514',
    'invalid quality status is rejected'
);

select throws_ok(
    $$
        insert into public.sensor_readings (
            sample_id, device_id, sensor_type, raw_value, quality_status
        )
        select gen_random_uuid(), device_id, 'light_lux', 10, 'ok'
        from _schema_test_context
    $$,
    '23503',
    'unknown sample foreign key is rejected'
);

select throws_ok(
    $$
        insert into public.sensor_readings (
            sample_id, device_id, sensor_type, raw_value, quality_status
        )
        select sample_id, device_id, 'light_lux', null, 'ok'
        from _schema_test_context
    $$,
    '23514',
    'an ok reading with null numeric value is rejected'
);

select * from finish();
