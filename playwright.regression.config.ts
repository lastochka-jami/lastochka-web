import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: 'regressions.e2e.ts', workers: 1,
  use: { baseURL:'http://127.0.0.1:3011', channel:'chrome', viewport:{width:390,height:844}, trace:'retain-on-failure' },
  webServer: [
    { command:'node tests/fixtures/api-server.cjs', url:'http://127.0.0.1:4010', reuseExistingServer:true },
    { command:'npm start', url:'http://127.0.0.1:3011', reuseExistingServer:true,
      env: {PORT:'3011', API_BASE_URL:'http://127.0.0.1:4010/api/v1', SESSION_ENCRYPTION_KEY:'0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', PUBLIC_ORIGIN:'http://127.0.0.1:3011', CHECKOUT_ENABLED:'false'}, },
  ],
});
