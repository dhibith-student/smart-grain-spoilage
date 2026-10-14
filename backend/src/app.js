import express from 'express';
import cors from 'cors';
import { authenticateDevice } from './auth.js';
import { createDashboardAuth } from './dashboard-auth.js';
import { parseHistoryQuery, validateDeviceId } from './query-validation.js';
import { validateIngestPayload } from './validation.js';

const asyncRoute = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

export function createApp({ supabase, deviceTokens, dashboardConfig, corsOrigins = ['http://localhost:5173'] }) {
  const app = express();
  const dashboardAuth = createDashboardAuth(dashboardConfig);
  app.disable('x-powered-by');
  app.use(cors({
    origin(origin, callback) {
      if (!origin || corsOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Origin is not allowed'));
    },
    credentials: true
  }));
  app.use(express.json({ limit: '64kb' }));

  app.get('/health/live', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.post('/api/v1/auth/login', (req, res) => {
    const { username, password } = req.body || {};
    if (typeof username !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'username and password are required' });
    }
    const token = dashboardAuth.login(username, password);
    if (!token) return res.status(401).json({ error: 'Invalid dashboard credentials' });
    return res.json({ authenticated: true, token });
  });

  app.post('/api/v1/auth/logout', dashboardAuth.middleware, (req, res) => {
    dashboardAuth.logout(req);
    res.status(204).end();
  });

  app.get('/api/v1/auth/me', dashboardAuth.middleware, (req, res) => {
    res.json({ authenticated: true, session: dashboardAuth.sessionInfo(req) });
  });

  app.post('/api/v1/ingest', asyncRoute(async (req, res) => {
    const authentication = authenticateDevice(req, deviceTokens);
    if (!authentication.ok) {
      return res.status(authentication.status).json({ error: authentication.message });
    }

    const validation = validateIngestPayload(req.body, authentication.deviceKey);
    if (!validation.ok) {
      return res.status(400).json({ error: 'Invalid payload', details: validation.errors });
    }

    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select('id, enabled')
      .eq('device_key', authentication.deviceKey)
      .maybeSingle();

    if (deviceError) throw deviceError;
    if (!device) return res.status(401).json({ error: 'Unknown device' });
    if (!device.enabled) return res.status(403).json({ error: 'Device is disabled' });

    const receivedAt = new Date().toISOString();
    const payload = req.body;
    const { data: sample, error: sampleError } = await supabase
      .from('sensor_samples')
      .insert({
        device_id: device.id,
        device_sequence_no: payload.device_sequence_no,
        measured_at: payload.measured_at || null,
        received_at: receivedAt,
        firmware_version: payload.firmware_version || null,
        payload_version: payload.payload_version,
        wifi_rssi: payload.wifi_rssi ?? null
      })
      .select('id')
      .single();

    if (sampleError?.code === '23505') {
      const { data: duplicate } = await supabase
        .from('sensor_samples')
        .select('id')
        .eq('device_id', device.id)
        .eq('device_sequence_no', payload.device_sequence_no)
        .maybeSingle();
      return res.status(200).json({ accepted: false, duplicate: true, sample_id: duplicate?.id || null });
    }
    if (sampleError) throw sampleError;

    const readings = payload.readings.map((reading) => ({
      sample_id: sample.id,
      device_id: device.id,
      sensor_type: reading.sensor_type,
      raw_value: reading.raw_value ?? null,
      calibrated_value: reading.calibrated_value ?? null,
      unit: reading.unit || null,
      quality_status: reading.quality_status,
      error_code: reading.error_code || null,
      metadata: reading.metadata || {}
    }));

    const { error: readingsError } = await supabase.from('sensor_readings').insert(readings);
    if (readingsError) {
      await supabase.from('sensor_samples').delete().eq('id', sample.id);
      throw readingsError;
    }

    const [{ error: deviceUpdateError }, { error: healthUpdateError }] = await Promise.all([
      supabase.from('devices').update({ last_seen_at: receivedAt }).eq('id', device.id),
      supabase.from('device_health').upsert({
      device_id: device.id,
      latest_successful_sample_at: receivedAt,
      latest_ingestion_at: receivedAt,
      firmware_version: payload.firmware_version || null,
      last_error: null,
      updated_at: receivedAt
      })
    ]);
    if (deviceUpdateError || healthUpdateError) {
      console.error('health_update_failed', deviceUpdateError?.message || healthUpdateError?.message);
    }

    return res.status(201).json({ accepted: true, duplicate: false, sample_id: sample.id });
  }));

  app.use('/api/v1', dashboardAuth.middleware);

  app.get('/api/v1/devices', asyncRoute(async (_req, res) => {
    const [{ data: devices, error: devicesError }, { data: health, error: healthError }] = await Promise.all([
      supabase.from('devices').select('id, device_key, name, grain_type, enabled, last_seen_at, created_at').order('name'),
      supabase.from('device_health').select('*')
    ]);
    if (devicesError) throw devicesError;
    if (healthError) throw healthError;
    const healthByDevice = new Map((health || []).map((item) => [item.device_id, item]));
    res.json({ devices: (devices || []).map((device) => ({ ...device, health: healthByDevice.get(device.id) || null })) });
  }));

  app.get('/api/v1/devices/:deviceId/latest', asyncRoute(async (req, res) => {
    if (!validateDeviceId(req.params.deviceId)) return res.status(400).json({ error: 'Invalid deviceId' });
    const deviceId = req.params.deviceId;
    const [{ data: device, error: deviceError }, { data: health, error: healthError }, { data: rows, error: readingsError }] = await Promise.all([
      supabase.from('devices').select('id, device_key, name, grain_type, enabled, last_seen_at, created_at').eq('id', deviceId).maybeSingle(),
      supabase.from('device_health').select('*').eq('device_id', deviceId).maybeSingle(),
      supabase.from('sensor_readings').select('*').eq('device_id', deviceId).order('created_at', { ascending: false }).limit(200)
    ]);
    if (deviceError) throw deviceError;
    if (healthError) throw healthError;
    if (readingsError) throw readingsError;
    if (!device) return res.status(404).json({ error: 'Device not found' });
    const latest = new Map();
    for (const reading of rows || []) if (!latest.has(reading.sensor_type)) latest.set(reading.sensor_type, reading);
    res.json({ device, health: health || null, readings: [...latest.values()] });
  }));

  app.get('/api/v1/devices/:deviceId/readings', asyncRoute(async (req, res) => {
    if (!validateDeviceId(req.params.deviceId)) return res.status(400).json({ error: 'Invalid deviceId' });
    const parsed = parseHistoryQuery(req.query);
    if (!parsed.ok) return res.status(400).json({ error: 'Invalid query', details: parsed.errors });
    let query = supabase.from('sensor_readings').select('*').eq('device_id', req.params.deviceId).order('created_at', { ascending: true }).limit(parsed.limit);
    if (parsed.sensor) query = query.eq('sensor_type', parsed.sensor);
    if (parsed.from) query = query.gte('created_at', parsed.from);
    if (parsed.to) query = query.lte('created_at', parsed.to);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ readings: data || [], query: parsed });
  }));

  app.get('/api/v1/devices/:deviceId/alerts', asyncRoute(async (req, res) => {
    if (!validateDeviceId(req.params.deviceId)) return res.status(400).json({ error: 'Invalid deviceId' });
    const parsed = parseHistoryQuery(req.query);
    if (!parsed.ok) return res.status(400).json({ error: 'Invalid query', details: parsed.errors });
    let query = supabase.from('alert_events').select('*').eq('device_id', req.params.deviceId).order('started_at', { ascending: false }).limit(parsed.limit);
    if (parsed.from) query = query.gte('started_at', parsed.from);
    if (parsed.to) query = query.lte('started_at', parsed.to);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ alerts: data || [], query: parsed });
  }));

  app.use((error, _req, res, _next) => {
    console.error('request_failed', error.message);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
