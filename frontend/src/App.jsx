import { useEffect, useMemo, useState } from 'react';
import { api, API_BASE_URL } from './api.js';

const SENSOR_META = {
  temperature_c: { label: 'Temperature', unit: '°C', icon: '°', tone: 'amber', decimals: 1 },
  humidity_percent: { label: 'Humidity', unit: '%', icon: 'H₂O', tone: 'blue', decimals: 1 },
  moisture_raw_adc: { label: 'Soil moisture', unit: 'ADC', icon: 'M', tone: 'teal', decimals: 0, raw: true },
  gas_raw_adc: { label: 'MQ-135 gas', unit: 'ADC', icon: 'G', tone: 'rose', decimals: 0, raw: true },
  light_lux: { label: 'Light', unit: 'lux', icon: 'L', tone: 'violet', decimals: 1 },
  sound_raw_adc: { label: 'Microphone', unit: 'ADC', icon: 'S', tone: 'slate', decimals: 0, raw: true }
};

const FIRMWARE_THRESHOLDS = [
  ['Temperature', '> 35 °C', 'Existing firmware warning'],
  ['Humidity', '> 75%', 'Existing firmware warning'],
  ['MQ-135', '> 1800 raw ADC', 'Uncalibrated comparison']
];

function formatTime(value) {
  if (!value) return 'No timestamp';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Invalid timestamp' : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function isStale(value) {
  return !value || Date.now() - new Date(value).getTime() > 5 * 60 * 1000;
}

function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api.login(username, password);
      onLogin(result.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="brand-mark">GW</div>
        <p className="eyebrow">SMART GRAIN SPOILAGE MONITOR</p>
        <h1>Keep watch over the store.</h1>
        <p className="muted login-copy">Sign in to view live environmental readings, device health, and recorded alerts.</p>
        <form onSubmit={submit} className="login-form">
          <label>Username<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required /></label>
          <label>Password<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" required /></label>
          {error && <div className="form-error">{error}</div>}
          <button className="primary-button" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <p className="tiny muted">Authentication is handled by the Express API. No Supabase secret is sent to this browser.</p>
      </section>
    </main>
  );
}

function StatusPill({ status, children }) {
  return <span className={`status-pill ${status || ''}`}><span className="status-dot" />{children}</span>;
}

function SensorCard({ type, reading }) {
  const meta = SENSOR_META[type];
  const value = reading?.raw_value ?? reading?.calibrated_value;
  const displayValue = typeof value === 'number' ? value.toFixed(meta.decimals) : '—';
  const quality = reading?.quality_status || 'unavailable';
  return (
    <article className={`sensor-card tone-${meta.tone}`}>
      <div className="sensor-top"><div className="sensor-icon">{meta.icon}</div><StatusPill status={quality === 'ok' ? 'good' : 'warn'}>{quality}</StatusPill></div>
      <p className="sensor-label">{meta.label}</p>
      <div className="sensor-value">{displayValue}<span>{meta.unit}</span></div>
      {meta.raw && <p className="raw-note">Raw / uncalibrated</p>}
      <p className="sensor-time">{formatTime(reading?.created_at)}</p>
    </article>
  );
}

function LineChart({ readings, selectedSensor }) {
  const points = readings.filter((item) => item.sensor_type === selectedSensor && typeof item.raw_value === 'number');
  if (!points.length) return <div className="chart-empty">No history for this sensor in the selected range.</div>;
  const values = points.map((point) => point.raw_value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min || 1;
  const width = 720;
  const height = 230;
  const padding = 24;
  const coordinates = points.map((point, index) => {
    const x = padding + (index / Math.max(points.length - 1, 1)) * (width - padding * 2);
    const y = height - padding - ((point.raw_value - min) / spread) * (height - padding * 2);
    return `${x},${y}`;
  }).join(' ');
  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${SENSOR_META[selectedSensor].label} history`}>
        <line x1="24" y1="24" x2="24" y2="206" className="chart-axis" />
        <line x1="24" y1="206" x2="696" y2="206" className="chart-axis" />
        <polyline points={coordinates} className="chart-line" />
        {points.map((point, index) => {
          const [x, y] = coordinates.split(' ')[index].split(',');
          return <circle key={`${point.created_at}-${index}`} cx={x} cy={y} r="3.5" className="chart-dot" />;
        })}
      </svg>
      <div className="chart-scale"><span>{min.toFixed(SENSOR_META[selectedSensor].decimals)} {SENSOR_META[selectedSensor].unit}</span><span>{max.toFixed(SENSOR_META[selectedSensor].decimals)} {SENSOR_META[selectedSensor].unit}</span></div>
    </div>
  );
}

function EmptyState({ onSimulated }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">⌁</div>
      <h2>No device data yet</h2>
      <p>Register a device and send a real or simulated ingestion payload to see readings here.</p>
      <code>POST /api/v1/ingest</code>
      <button className="secondary-button" onClick={onSimulated}>View simulated payload instructions</button>
    </div>
  );
}

function Dashboard({ token, onLogout }) {
  const [devices, setDevices] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [latest, setLatest] = useState(null);
  const [readings, setReadings] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [range, setRange] = useState('24h');
  const [chartSensor, setChartSensor] = useState('temperature_c');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const selectedDevice = devices.find((device) => device.id === selectedId);
  const rangeQuery = useMemo(() => {
    const hours = range === '24h' ? 24 : range === '7d' ? 24 * 7 : 24 * 30;
    return `from=${encodeURIComponent(new Date(Date.now() - hours * 60 * 60 * 1000).toISOString())}&limit=500`;
  }, [range]);

  async function loadDevices() {
    const result = await api.devices(token);
    setDevices(result.devices || []);
    setSelectedId((current) => current || result.devices?.[0]?.id || '');
  }

  async function loadDeviceData(deviceId = selectedId) {
    if (!deviceId) return;
    const [latestResult, readingsResult, alertsResult] = await Promise.all([
      api.latest(deviceId, token),
      api.readings(deviceId, rangeQuery, token),
      api.alerts(deviceId, token)
    ]);
    setLatest(latestResult);
    setReadings(readingsResult.readings || []);
    setAlerts(alertsResult.alerts || []);
  }

  useEffect(() => {
    loadDevices().catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    loadDeviceData().catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, [selectedId, rangeQuery]);

  const latestByType = new Map((latest?.readings || []).map((reading) => [reading.sensor_type, reading]));
  const lastSeen = selectedDevice?.last_seen_at || latest?.device?.last_seen_at || latest?.health?.latest_ingestion_at;
  const online = lastSeen && !isStale(lastSeen);

  async function logout() {
    try { await api.logout(token); } finally { onLogout(); }
  }

  if (loading && !devices.length) return <div className="app-loading"><div className="spinner" />Loading monitor…</div>;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-row"><div className="brand-mark small">GW</div><div><strong>GrainWatch</strong><span>Storage monitor</span></div></div>
        <nav><a className="nav-link active" href="#overview"><span>◈</span>Overview</a><a className="nav-link" href="#history"><span>⌁</span>History</a><a className="nav-link" href="#alerts"><span>!</span>Alerts</a></nav>
        <div className="sidebar-footer"><span className="tiny muted">API endpoint</span><code>{API_BASE_URL}</code><button className="logout-button" onClick={logout}>Sign out</button></div>
      </aside>
      <main className="main-content">
        <header className="topbar"><div><p className="eyebrow">STORAGE INTELLIGENCE</p><h1>Overview</h1></div><div className="top-actions"><StatusPill status={online ? 'good' : 'warn'}>{online ? 'Device online' : 'No recent signal'}</StatusPill><button className="icon-button" onClick={() => { setLoading(true); Promise.all([loadDevices(), loadDeviceData()]).catch((err) => setError(err.message)).finally(() => setLoading(false)); }} aria-label="Refresh">↻</button></div></header>
        {error && <div className="banner error-banner">{error}<button onClick={() => setError('')}>×</button></div>}
        {!devices.length ? <EmptyState onSimulated={() => setNotice('Use the simulated JSON at supabase/examples/simulated-ingest-payload.json with the documented POST command.')} /> : (
          <>
            <section className="toolbar"><div><span className="tiny muted">MONITORED DEVICE</span><select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>{devices.map((device) => <option key={device.id} value={device.id}>{device.name} · {device.device_key}</option>)}</select></div><div className="device-meta"><span>{selectedDevice?.grain_type || 'Grain type not configured'}</span><span>Last seen {formatTime(lastSeen)}</span></div></section>
            <section className="overview-grid">{Object.keys(SENSOR_META).map((type) => <SensorCard key={type} type={type} reading={latestByType.get(type)} />)}</section>
            <section className="content-grid" id="history"><article className="panel chart-panel"><div className="panel-heading"><div><p className="eyebrow">TREND VIEW</p><h2>Sensor history</h2></div><div className="control-row"><select value={chartSensor} onChange={(event) => setChartSensor(event.target.value)}>{Object.entries(SENSOR_META).map(([type, meta]) => <option key={type} value={type}>{meta.label}</option>)}</select><div className="segmented">{['24h', '7d', '30d'].map((item) => <button className={range === item ? 'selected' : ''} key={item} onClick={() => setRange(item)}>{item}</button>)}</div></div></div><LineChart readings={readings} selectedSensor={chartSensor} /></article><article className="panel threshold-panel"><div className="panel-heading"><div><p className="eyebrow">RULE DISPLAY</p><h2>Current warnings</h2></div></div><p className="muted small-copy">Shown from the existing firmware configuration. These are not universal spoilage thresholds.</p>{FIRMWARE_THRESHOLDS.map(([name, value, note]) => <div className="threshold-row" key={name}><div><strong>{name}</strong><span>{note}</span></div><b>{value}</b></div>)}<div className="raw-callout"><strong>Raw readings stay raw</strong><span>MQ-135 gas and microphone values are not converted into CO₂, decibels, or a spoilage diagnosis.</span></div></article></section>
            <section className="content-grid" id="alerts"><article className="panel"><div className="panel-heading"><div><p className="eyebrow">EVENT LOG</p><h2>Alert history</h2></div><span className="count-badge">{alerts.length}</span></div>{alerts.length ? <div className="alert-list">{alerts.map((alert) => <div className="alert-row" key={alert.id}><div className={`alert-severity ${alert.severity}`}>{alert.severity}</div><div><strong>{alert.alert_type.replaceAll('_', ' ')}</strong><span>{formatTime(alert.started_at)}{alert.ended_at ? ` · ended ${formatTime(alert.ended_at)}` : ' · active'}</span></div></div>)}</div> : <div className="panel-empty">No alerts recorded for this device.</div>}</article><article className="panel health-panel"><div className="panel-heading"><div><p className="eyebrow">DEVICE HEALTH</p><h2>Connection</h2></div><StatusPill status={online ? 'good' : 'warn'}>{online ? 'Healthy' : 'Stale'}</StatusPill></div><div className="health-stat"><span>Last successful sample</span><strong>{formatTime(latest?.health?.latest_successful_sample_at)}</strong></div><div className="health-stat"><span>Firmware version</span><strong>{latest?.health?.firmware_version || 'Not reported'}</strong></div><div className="health-stat"><span>Last error</span><strong>{latest?.health?.last_error || 'None reported'}</strong></div></article></section>
          </>
        )}
        {notice && <div className="notice" onClick={() => setNotice('')}>{notice}</div>}
        <footer className="footer">Smart Grain Spoilage Monitor <span>·</span> Data comes from the Express API only</footer>
      </main>
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem('grain_dashboard_token'));
  const [checking, setChecking] = useState(Boolean(token));

  useEffect(() => {
    if (!token) return undefined;
    api.me(token).catch(() => { sessionStorage.removeItem('grain_dashboard_token'); setToken(null); }).finally(() => setChecking(false));
    return undefined;
  }, []);

  function login(newToken) {
    sessionStorage.setItem('grain_dashboard_token', newToken);
    setToken(newToken);
  }

  function logout() {
    sessionStorage.removeItem('grain_dashboard_token');
    setToken(null);
  }

  if (checking) return <div className="app-loading"><div className="spinner" />Checking session…</div>;
  return token ? <Dashboard token={token} onLogout={logout} /> : <Login onLogin={login} />;
}
