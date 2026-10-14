import { createClient } from '@supabase/supabase-js';
import { createApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

createApp({
  supabase,
  deviceTokens: config.deviceTokens,
  dashboardConfig: {
    username: config.dashboardUsername,
    password: config.dashboardPassword
  },
  corsOrigins: config.corsOrigins
})
  .listen(config.port, () => {
    console.log(`Smart Grain backend listening on port ${config.port}`);
  });
