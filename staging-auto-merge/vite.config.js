import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Using "ssr" config to get Vite's defaults for code running in Node
  ssr: {
    noExternal: true,
  },
  build: {
    ssr: 'src/index.js',
    target: 'node24',
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      external: [],
      output: {
        entryFileNames: 'index.js',
        format: 'es',
        inlineDynamicImports: true,
      },
    },
  },
  test: {
    environment: 'node',
    globals: true,
  },
})
