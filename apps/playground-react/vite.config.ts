import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [react()],
    // Relative asset paths, so the build works wherever it is hosted, such as
    // https://mailblocks.github.io/mailblocks/ on GitHub Pages.
    base: './',
    server: { port: 5174 },
});
