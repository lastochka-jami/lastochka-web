import {defineConfig} from '@playwright/test';

export default defineConfig({
  testDir:'./tests', testMatch:'**/*.e2e.ts', timeout:45_000, workers:2,
  expect:{timeout:10_000},
  use:{baseURL:'http://127.0.0.1:3011',channel:'chrome',trace:'retain-on-failure'},
  projects:[
    {name:'mobile-chromium',use:{viewport:{width:390,height:844},hasTouch:true}},
    {name:'desktop-chromium',use:{viewport:{width:1440,height:1000}}},
  ],
  webServer:[
    {command:'node tests/fixtures/api-server.cjs',url:'http://127.0.0.1:4010',reuseExistingServer:true},
    {command:'npm start',url:'http://127.0.0.1:3011',reuseExistingServer:true,timeout:60_000,
      env:{PORT:'3011',API_BASE_URL:'http://127.0.0.1:4010/api/v1',SESSION_ENCRYPTION_KEY:'0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',PUBLIC_ORIGIN:'http://127.0.0.1:3011',DEFAULT_STORE_ID:'2',CHECKOUT_ENABLED:'false'}},
  ],
});
