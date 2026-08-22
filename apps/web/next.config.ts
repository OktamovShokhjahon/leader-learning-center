import createNextIntlPlugin from 'next-intl/plugin'
import type { NextConfig } from 'next'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig: NextConfig = {
  /**
   * `next dev` and `next build` both write `.next` by default, so building
   * while the dev server is up overwrites the chunks that server is still
   * serving. It then throws `__webpack_modules__[moduleId] is not a function`
   * and a React Client Manifest error — a 500 that reads like a code bug and
   * is not one.
   *
   * Giving the two their own directories makes that impossible. Detected from
   * the command rather than an env var so the npm scripts stay plain and it
   * works however Next is invoked; `start` reads what `build` wrote.
   *
   * Written inline on purpose: Next transpiles this file to
   * `next.config.compiled.js` and keeps only the exported object, so a
   * top-level `const` referenced here would be dropped and throw
   * `ReferenceError` on a cold start.
   */
  distDir: ['build', 'start'].includes(process.argv[2] ?? '') ? '.next-build' : '.next',
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'motion'],
  },
}

export default withNextIntl(nextConfig)
