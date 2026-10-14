import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';

const deviceId = '11111111-1111-4111-8111-111111111111';

function createMockSupabase() {
  const calls = [];
  const device = {
    id: deviceId,
    device_key: 'esp32-grain-01',
    name: 'Test device',
    grain_type: null,
    enabled: true,
    last_seen_at: null,
    created_at: '2026-10-14T00:00:00.000Z'
  };

  return {
    calls,
    from(table) {
      if (table === 'devices') {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: device, error: null }) }),
            order: async () => ({ data: [device], error: null })
          }),
          update: (values) => ({
            eq: async () => {
              calls.push({ table, operation: 'update', values });
              return { error: null };
            }
          })
        };
      }
      if (table === 'sensor_samples') {
        return {
          insert: (values) => ({
            select: () => ({ single: async () => {
              calls.push({ table, operation: 'insert', values });
              return { data: { id: '22222222-2222-4222-8222-222222222222' }, error: null };
            } })
          }),
          delete: () => ({ eq: async () => ({ error: null }) })
        };
      }
      if (table === 'sensor_readings') {
        return {
          insert: async (values) => {
            calls.push({ table, operation: 'insert', values });
            return { error: null };
          }
        };
      }
      if (table === 'device_health') {
        return {
          upsert: async (values) => {
            calls.push({ table, operation: 'upsert', values });
            return { error: null };
          }
        };
      }
      throw new Error(`Unexpected table in test: ${table}`);
    }
  };
}

function createTestApp() {
  const supabase = createMockSupabase();
  const app = createApp({
    supabase,
    deviceTokens: { 'esp32-grain-01': 'device-test-token' },
    dashboardConfig: { username: 'admin', password: 'dashboard-test-password' },
    corsOrigins: ['http://localhost:5173']
  });
  return { app, supabase };
}

const payload = {
  device_key: 'esp32-grain-01',
  device_sequence_no: 7,
  measured_at: '2026-10-14T09:00:00Z',
  firmware_version: 'test-firmware',
  payload_version: '1',
  wifi_rssi: -60,
  readings: [
    { sensor_type: 'temperature_c', raw_value: 28.4, unit: '°C', quality_status: 'ok', metadata: {} },
    { sensor_type: 'humidity_percent', raw_value: 64, unit: '%', quality_status: 'ok', metadata: {} },
    { sensor_type: 'moisture_raw_adc', raw_value: 1700, unit: 'adc_counts', quality_status: 'ok', metadata: {} },
    { sensor_type: 'gas_raw_adc', raw_value: 920, unit: 'adc_counts', quality_status: 'ok', metadata: {} },
    { sensor_type: 'light_lux', raw_value: 115.2, unit: 'lux', quality_status: 'ok', metadata: {} },
    { sensor_type: 'sound_raw_adc', raw_value: 640, unit: 'adc_counts', quality_status: 'ok', metadata: {} }
  ]
};

test('health endpoint is public', async () => {
  const { app } = createTestApp();
  const response = await request(app).get('/health/live');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: 'ok' });
});

test('dashboard login returns a session token', async () => {
  const { app } = createTestApp();
  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({ username: 'admin', password: 'dashboard-test-password' });
  assert.equal(response.status, 200);
  assert.equal(response.body.authenticated, true);
  assert.equal(typeof response.body.token, 'string');
});

test('dashboard login trims username whitespace but preserves password exactness', async () => {
  const { app } = createTestApp();
  const accepted = await request(app)
    .post('/api/v1/auth/login')
    .send({ username: '  admin  ', password: 'dashboard-test-password' });
  assert.equal(accepted.status, 200);

  const rejected = await request(app)
    .post('/api/v1/auth/login')
    .send({ username: 'admin', password: ' dashboard-test-password' });
  assert.equal(rejected.status, 401);
});

test('ingestion rejects missing or invalid device credentials', async () => {
  const { app } = createTestApp();
  const response = await request(app).post('/api/v1/ingest').send(payload);
  assert.equal(response.status, 401);
});

test('ingestion validates payloads before database access', async () => {
  const { app } = createTestApp();
  const response = await request(app)
    .post('/api/v1/ingest')
    .set('x-device-key', 'esp32-grain-01')
    .set('x-device-token', 'device-test-token')
    .send({ ...payload, readings: [{ sensor_type: 'gas_raw_adc', raw_value: null, quality_status: 'ok' }] });
  assert.equal(response.status, 400);
  assert.equal(response.body.error, 'Invalid payload');
});

test('valid ingestion inserts a sample, readings, and health update', async () => {
  const { app, supabase } = createTestApp();
  const response = await request(app)
    .post('/api/v1/ingest')
    .set('x-device-key', 'esp32-grain-01')
    .set('x-device-token', 'device-test-token')
    .send(payload);
  assert.equal(response.status, 201);
  assert.equal(response.body.accepted, true);
  assert.ok(supabase.calls.some((call) => call.table === 'sensor_samples'));
  assert.ok(supabase.calls.some((call) => call.table === 'sensor_readings'));
  assert.ok(supabase.calls.some((call) => call.table === 'device_health'));
});
