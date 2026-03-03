import { defineConfig } from 'vitest/config'

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.js',
      formats: ['es'],
      fileName: () => 'index.js',
    },
    outDir: 'dist',
    rollupOptions: {
      external: [],
      output: {
        inlineDynamicImports: true,
      },
    },
  },
  test: {
    environment: 'node',
    globals: true,
  },
})
