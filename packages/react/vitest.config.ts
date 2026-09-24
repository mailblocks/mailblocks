import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'jsdom',
        setupFiles: ['./src/test-setup.ts'],
        include: ['src/**/*.test.tsx'],
        // CSS is blanked in tests unless included; the stylesheet test reads styles.css.
        css: { include: [/styles\.css/] },
    },
});
