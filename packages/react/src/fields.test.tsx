import { describe, expect, it } from 'vitest';
import { normalizeHex } from './fields';

describe('normalizeHex()', () => {
    it('reads three or six hex digits, with or without #', () => {
        expect(normalizeHex('#F00')).toBe('#ff0000');
        expect(normalizeHex(' 1a2B3c ')).toBe('#1a2b3c');
        expect(normalizeHex('#abc')).toBe('#aabbcc');
    });

    it('refuses anything else', () => {
        for (const input of ['', 'red', '#12', '#1234', '#12345g', 'rgb(0,0,0)']) {
            expect(normalizeHex(input), input).toBeUndefined();
        }
    });
});
