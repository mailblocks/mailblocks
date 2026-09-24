import { describe, expect, it } from 'vitest';
import css from './styles.css?raw';

/** Custom properties declared by the first rule whose selector is exactly `selector`. */
function palette(selector: string): Record<string, string> {
    const start = css.indexOf(`${selector} {`);
    if (start < 0) throw new Error(`No rule for ${selector}`);
    const body = css.slice(start, css.indexOf('}', start));
    return Object.fromEntries(
        Array.from(body.matchAll(/(--mb-[\w-]+):\s*([^;]+);/g), (match) => [match[1], match[2]]),
    );
}

const light = palette(':where(.mb-editor)');
const pinnedDark = palette(":where(.mb-editor[data-theme='dark'])");
const systemDark = palette(":where(.mb-editor:not([data-theme='light']))");

describe('editor theme', () => {
    it('uses the same dark palette whether it is pinned or comes from the system', () => {
        expect(Object.keys(pinnedDark).length).toBeGreaterThan(0);
        expect(systemDark).toEqual(pinnedDark);
    });

    it('only overrides colours the light palette defines', () => {
        for (const name of Object.keys(pinnedDark)) expect(light, name).toHaveProperty(name);
    });

    it('defines every colour the stylesheet uses', () => {
        const used = new Set(
            Array.from(css.matchAll(/var\((--mb-[\w-]+)\)/g), (match) => match[1]!),
        );
        // Set by the .mb-status-* classes for the report's section markers.
        used.delete('--mb-status-color');
        for (const name of used) expect(light, name).toHaveProperty(name);
    });
});
