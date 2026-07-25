import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
    exclude: ['tests/**/*.e2e.spec.js', 'node_modules/**', 'dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: [
        'src/pages/Convert.jsx',
        'src/pages/PDFEditor.jsx',
        'src/pages/QRCodeCreator.jsx',
        'src/pages/Ocr.jsx',
        'src/lib/ocrUtils.js',
        'src/lib/fileTypes.js',
        'src/lib/qrCodePayload.js',
        'src/services/conversionService.js',
        'src/services/pdfEditorService.js',
      ],
      exclude: ['tests/**'],
      thresholds: {
        statements: 40,
        branches: 38,
        functions: 25,
        lines: 42,
      },
    },
  },
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
