const required = (name) => {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

export function loadConfig() {
  let deviceTokens;
  try {
    deviceTokens = JSON.parse(required('DEVICE_TOKENS_JSON'));
  } catch (error) {
    throw new Error(`DEVICE_TOKENS_JSON must be valid JSON: ${error.message}`);
  }

  if (!deviceTokens || Array.isArray(deviceTokens) || typeof deviceTokens !== 'object') {
    throw new Error('DEVICE_TOKENS_JSON must be a JSON object');
  }

  return {
    port: Number.parseInt(process.env.PORT || '3000', 10),
    supabaseUrl: required('SUPABASE_URL'),
    supabaseServiceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
    deviceTokens,
    dashboardUsername: required('DASHBOARD_USERNAME'),
    dashboardPassword: required('DASHBOARD_PASSWORD'),
    corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
  };
}
