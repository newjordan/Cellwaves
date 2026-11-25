import { defineConfig } from 'vitest/config';

export default defineConfig({
    // Relative asset URLs so the same build works at the GitHub Pages project root.
    base: './',
    server: {
        port: 5173,
        strictPort: false,
    },
    build: {
        outDir: 'dist',
        sourcemap: true,
        emptyOutDir: true,
    },
    test: {
        environment: 'happy-dom',
        include: ['tests/**/*.test.js'],
        setupFiles: ['tests/setup.js'],
    },
});
