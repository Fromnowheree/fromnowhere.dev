import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // The `@/` and `@payload-config` paths from tsconfig.json, which Vite 8 reads itself.
  resolve: { tsconfigPaths: true },
  test: {
    // Node, not jsdom: everything tested here runs on the server, and under jsdom's globals
    // Payload's upload type detection rejects a Buffer (the seed's generated pictures).
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/int/**/*.int.spec.{ts,tsx}'],
    // The integration tests share one database (DATABASE_URL), and each file boots Payload,
    // which pushes the schema in development; two files pushing at once can collide.
    fileParallelism: false,
    // next-intl imports `next/navigation` without an extension, which Node's own ESM loader
    // cannot resolve; through Vite it resolves, so the chrome's language-aware links render.
    server: { deps: { inline: ['next-intl'] } },
  },
})
