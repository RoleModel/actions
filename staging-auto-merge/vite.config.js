import { defineConfig } from 'vitest/config'

export default defineConfig({
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
