import type { CompatWarning } from '@mailblocks/core';
import { describe, expect, it } from 'vitest';
import { describeWarning, explainWarning, propertyLabel } from './labels';

function warning(patch: Partial<CompatWarning>): CompatWarning {
    return {
        subject: { type: 'document' },
        property: 'padding',
        feature: 'css-padding',
        target: { family: 'outlook', platform: 'windows' },
        level: 'n',
        version: '2019',
        notes: [],
        ...patch,
    };
}

describe('labels', () => {
    it('names styles for people, and falls back to the property', () => {
        expect(propertyLabel('borderRadius')).toBe('Rounded corners');
        expect(propertyLabel('somethingNew')).toBe('somethingNew');
    });

    it('describes a warning in one line', () => {
        expect(describeWarning(warning({}))).toBe('Padding: not supported in Outlook Windows');
    });

    it('explains unsupported styles, images and unknown results', () => {
        expect(explainWarning(warning({}))).toBe('The spacing is ignored here.');
        expect(explainWarning(warning({ feature: 'image-webp', property: 'src' }))).toMatch(
            /^The image does not show here/,
        );
        expect(explainWarning(warning({ feature: 'css-something-new' }))).toMatch(
            /ignores this style/,
        );
        expect(explainWarning(warning({ level: 'u' }))).toMatch(/has not tested/);
    });

    it("leaves partial support to Can I Email's notes when it has some", () => {
        expect(explainWarning(warning({ level: 'a', notes: ['Partial. Only on cells.'] }))).toBe(
            undefined,
        );
        expect(explainWarning(warning({ level: 'a' }))).toMatch(/gives no details/);
    });
});
