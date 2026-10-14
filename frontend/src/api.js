const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

async function request(path, options = {}, token) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  } catch {
    throw new Error('The API is unreachable. Check the backend URL and server status.');
  }

  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : null;
  if (!response.ok) {
    const error = new Error(body?.error || `Request failed with status ${response.status}`);
    error.status = response.status;
    error.details = body?.details;
    throw error;
  }
  return body;
}

export const api = {
  login: (username, password) => request('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  }),
  me: (token) => request('/api/v1/auth/me', {}, token),
  logout: (token) => request('/api/v1/auth/logout', { method: 'POST' }, token),
  devices: (token) => request('/api/v1/devices', {}, token),
  latest: (deviceId, token) => request(`/api/v1/devices/${deviceId}/latest`, {}, token),
  readings: (deviceId, range, token) => request(`/api/v1/devices/${deviceId}/readings?${range}`, {}, token),
  alerts: (deviceId, token) => request(`/api/v1/devices/${deviceId}/alerts?limit=20`, {}, token)
};

export { API_BASE_URL };
