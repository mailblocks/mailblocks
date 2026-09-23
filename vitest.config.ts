import { defineConfig } from 'vitest/config';

// Kept separate from vite.config.ts, whose `root: 'playground'` would hide the tests.
export default defineConfig({
    test: {
        include: ['src/**/*.test.ts'],
    },
});
