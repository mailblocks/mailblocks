import { describe, expect, it } from 'vitest';
import { normalizeLink } from './links';

describe('normalizeLink()', () => {
    it('keeps web, email and phone links', () => {
        expect(normalizeLink('https://example.com/a?b=1')).toBe('https://example.com/a?b=1');
        expect(normalizeLink('HTTP://example.com')).toBe('HTTP://example.com');
        expect(normalizeLink('mailto:hi@example.com')).toBe('mailto:hi@example.com');
        expect(normalizeLink('tel:+201000000000')).toBe('tel:+201000000000');
    });

    it('completes bare domains and email addresses', () => {
        expect(normalizeLink('  example.com  ')).toBe('https://example.com');
        expect(normalizeLink('www.example.com/sale#top')).toBe('https://www.example.com/sale#top');
        expect(normalizeLink('hi@example.com')).toBe('mailto:hi@example.com');
    });

    it('refuses anything else', () => {
        for (const input of [
            '',
            '   ',
            'javascript:alert(1)',
            'JavaScript:alert(1)',
            'data:text/html,hi',
            '/relative/path',
            'example',
            'https://',
            'two words.com',
        ]) {
            expect(normalizeLink(input), input).toBeUndefined();
        }
    });
});
