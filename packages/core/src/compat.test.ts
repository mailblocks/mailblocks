import { describe, expect, it } from 'vitest';
import { families, featureUrl, features, platforms, support, supportDetails } from './compat';

describe('support()', () => {
    it('returns the support level of the latest tested version', () => {
        // Gmail desktop webmail, 2025-11: "y #4"
        expect(support('css-text-align', 'gmail', 'desktop-webmail')).toBe('y');
        // Outlook on Windows, 2019: "a #1 #3"
        expect(support('css-text-align', 'outlook', 'windows')).toBe('a');
    });

    it('keeps Can I Email version order instead of JavaScript key order', () => {
        // Outlook on macOS is tested as 2011, 2016, 16.80 (oldest to newest). A naive
        // JSON.parse would enumerate "2011" and "2016" first and pick 16.80 by luck,
        // but apple-mail/macos "11, 12, 10.13, 10.15" would pick 10.15 instead of 12.
        expect(features['css-animation']?.stats.outlook?.macos?.[0]).toBe('16.80');
    });

    it('returns undefined when Can I Email has no data for that client platform', () => {
        // Gmail has no Windows desktop app
        expect(support('css-text-align', 'gmail', 'windows')).toBeUndefined();
    });

    it('throws on an unknown feature slug', () => {
        expect(() => support('css-font-family', 'gmail', 'ios')).toThrow(
            /Unknown Can I Email feature/,
        );
    });

    it('exposes the client families and platforms found in the data', () => {
        expect(families).toContain('gmail');
        expect(families).toContain('outlook');
        expect(platforms).toContain('desktop-webmail');
        expect(platforms).toContain('windows');
    });
});

describe('supportDetails()', () => {
    it('returns the level, the tested version and the matching footnotes', () => {
        // Outlook on Windows, 2019: "a #1 #3"
        const details = supportDetails('css-text-align', 'outlook', 'windows');
        expect(details?.level).toBe('a');
        expect(details?.version).toBe('2019');
        expect(details?.notes).toHaveLength(2);
        expect(details?.notes[0]).toMatch(/start/);
    });

    it('returns no footnotes when the result has none', () => {
        // Gmail on iOS, 2025-11: "y"
        expect(supportDetails('css-text-align', 'gmail', 'ios')?.notes).toEqual([]);
    });

    it('returns undefined when Can I Email has no data for that client platform', () => {
        expect(supportDetails('css-text-align', 'gmail', 'windows')).toBeUndefined();
    });
});

describe('featureUrl()', () => {
    it('links to the feature page on caniemail.com', () => {
        expect(featureUrl('css-at-media-prefers-color-scheme')).toBe(
            'https://www.caniemail.com/features/css-at-media-prefers-color-scheme/',
        );
    });
});
