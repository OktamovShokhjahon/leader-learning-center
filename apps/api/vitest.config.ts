import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // TZ §27 — ≥70% coverage on services/ is the gate; wired up as modules land.
    coverage: { provider: 'v8', include: ['src/**/*.service.ts'] },
  },
})
