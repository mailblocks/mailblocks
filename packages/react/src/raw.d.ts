// Vite's `?raw` imports, used by the tests to read files as text.
declare module '*?raw' {
    const content: string;
    export default content;
}
