import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'Kanakku',
        short_name: 'Kanakku',
        description: 'Self-hosted personal finance tracker',
        theme_color: '#863bff',
        background_color: '#09090b',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        runtimeCaching: [
          {
            // Network-first for all API GET requests
            urlPattern: ({ url }) => url.pathname.startsWith('/api/') && !url.pathname.includes('/download'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 5, // 5 minutes
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
  server: {
    // Proxy /api to a locally running backend (uvicorn on 8000).
    // Only active when VITE_MOCK_API is not true — MSW handles requests otherwise.
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['**/node_modules/**', '**/e2e/**'],
    coverage: {
      // v8 provider (already in devDependencies as @vitest/coverage-v8).
      //   coverage/lcov.info → consumed by SonarQube (sonar.javascript.lcov.reportPaths)
      //   coverage/index.html → open directly, no server needed
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      // Still emit reports when some tests fail (this suite has known failures),
      // and include untested files so the coverage denominator is honest.
      reportOnFailure: true,
      all: true,
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/test/**',
        'src/mocks/**',
        'src/main.tsx',
        'src/**/*.d.ts',
      ],
    },
  },
})
