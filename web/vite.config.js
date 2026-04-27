import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const plotlyBundle = path.resolve(
  __dirname,
  'node_modules/plotly.js-dist/plotly.js',
)

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const anthropicKey =
    env.ANTHROPIC_API_KEY || env.VITE_ANTHROPIC_API_KEY || ''
  const openaiKey = env.OPENAI_API_KEY || env.VITE_OPENAI_API_KEY || ''
  const geminiKey =
    env.GEMINI_API_KEY ||
    env.VITE_GEMINI_API_KEY ||
    env.VITE_GOOGLE_API_KEY ||
    ''

  return {
    test: {
      environment: 'node',
      include: ['src/**/*.test.js'],
    },
    plugins: [react()],
    resolve: {
      alias: [
        // react-plotly.js pulls `plotly.js/dist/plotly` — map both to the prebuilt bundle
        { find: 'plotly.js/dist/plotly', replacement: plotlyBundle },
        { find: /^plotly\.js$/, replacement: plotlyBundle },
      ],
    },
    optimizeDeps: {
      include: ['plotly.js-dist', 'react-plotly.js'],
    },
    server: {
      proxy: {
        '/api/anthropic': {
          target: 'https://api.anthropic.com',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/anthropic/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (anthropicKey) {
                proxyReq.setHeader('x-api-key', anthropicKey)
              }
              proxyReq.setHeader('anthropic-version', '2023-06-01')
            })
          },
        },
        '/api/openai': {
          target: 'https://api.openai.com',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/openai/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (openaiKey) {
                proxyReq.setHeader('Authorization', `Bearer ${openaiKey}`)
              }
            })
          },
        },
        '/api/gemini': {
          target: 'https://generativelanguage.googleapis.com',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/gemini/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              let pathAndQuery = proxyReq.path || ''
              if (geminiKey && !pathAndQuery.includes('key=')) {
                const sep = pathAndQuery.includes('?') ? '&' : '?'
                pathAndQuery = `${pathAndQuery}${sep}key=${encodeURIComponent(geminiKey)}`
                proxyReq.path = pathAndQuery
              }
            })
          },
        },
      },
    },
  }
})
