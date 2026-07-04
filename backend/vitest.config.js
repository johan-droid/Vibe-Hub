import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*',
      '**/test/api.test.js',
      '**/test/auth.test.js',
      '**/test/idempotency.test.js',
      '**/test/integration-api.test.js',
      '**/test/observability.test.js',
      '**/test/ops-config.test.js',
    ],
  },
});
