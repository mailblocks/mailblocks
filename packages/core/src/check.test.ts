import { describe, expect, it } from 'vitest';
import { check, checkBlock, imageFormatFeature, type Target } from './check';
import {
    createButtonBlock,
    createEmptyDocument,
    createImageBlock,
    createRow,
    createTextBlock,
    type EmailDocument,
} from './model';

const GMAIL_DESKTOP: Target = { family: 'gmail', platform: 'desktop-webmail' };
const OUTLOOK_WINDOWS: Target = { family: 'outlook', platform: 'windows' };

function documentWith(...blocks: ReturnType<typeof createTextBlock>[]): EmailDocument {
    const doc = createEmptyDocument();
    const row = createRow();
    row.columns[0]?.blocks.push(...blocks);
    doc.rows.push(row);
    return doc;
}

describe('check()', () => {
    it('returns nothing for an empty document', () => {
        expect(check(createEmptyDocument(), [GMAIL_DESKTOP, OUTLOOK_WINDOWS])).toEqual([]);
    });

    it('returns nothing when every target fully supports the styles', () => {
        // Gmail desktop webmail supports font-size, line-height and padding.
        expect(check(documentWith(createTextBlock()), [GMAIL_DESKTOP])).toEqual([]);
    });

    it('warns once per unsupported style per target', () => {
        // Outlook on Windows only partially supports font-size, line-height and padding.
        const block = createTextBlock();
        const warnings = check(documentWith(block), [OUTLOOK_WINDOWS]);

        expect(warnings.map((w) => w.property).sort()).toEqual([
            'fontSize',
            'lineHeight',
            'padding',
        ]);
        expect(warnings.every((w) => w.blockId === block.id)).toBe(true);
        expect(warnings.every((w) => w.target === OUTLOOK_WINDOWS)).toBe(true);
        expect(warnings.every((w) => w.level === 'a')).toBe(true);
    });

    it('explains partial support with Can I Email footnotes', () => {
        const [warning] = check(documentWith(createTextBlock()), [OUTLOOK_WINDOWS]).filter(
            (w) => w.property === 'fontSize',
        );
        expect(warning?.feature).toBe('css-font-size');
        expect(warning?.version).toBe('2021');
        expect(warning?.notes.length).toBeGreaterThan(0);
    });

    it('checks every block in every column', () => {
        const doc = createEmptyDocument();
        const row = createRow(2);
        row.columns[0]?.blocks.push(createTextBlock());
        row.columns[1]?.blocks.push(createTextBlock(), createTextBlock());
        doc.rows.push(row);

        const warnings = check(doc, [OUTLOOK_WINDOWS]);
        expect(new Set(warnings.map((w) => w.blockId)).size).toBe(3);
    });
});

describe('checkBlock()', () => {
    it('ignores styles the block does not use', () => {
        // fontFamily is unset and textAlign is the default, so neither is checked.
        const properties = checkBlock(createTextBlock(), [OUTLOOK_WINDOWS]).map((w) => w.property);
        expect(properties).not.toContain('fontFamily');
        expect(properties).not.toContain('textAlign');
    });

    it('checks a style once the block sets it', () => {
        const block = createTextBlock();
        block.styles.textAlign = 'center';
        const warning = checkBlock(block, [OUTLOOK_WINDOWS]).find(
            (w) => w.property === 'textAlign',
        );
        expect(warning?.feature).toBe('css-text-align');
        expect(warning?.level).toBe('a');
    });
});

describe('image blocks', () => {
    it('warns about image formats the target cannot show', () => {
        const block = createImageBlock('https://example.com/photo.webp?size=lg', '');
        const warnings = checkBlock(block, [OUTLOOK_WINDOWS]);
        const format = warnings.find((w) => w.property === 'src');
        expect(format?.feature).toBe('image-webp');
        expect(format?.level).toBe('n');
    });

    it('stays quiet about formats every client shows', () => {
        const block = createImageBlock('https://example.com/photo.jpg', '');
        expect(checkBlock(block, [GMAIL_DESKTOP]).map((w) => w.property)).not.toContain('src');
    });

    it('warns about border radius only when set', () => {
        const block = createImageBlock('https://example.com/a.png', '');
        expect(checkBlock(block, [OUTLOOK_WINDOWS]).map((w) => w.property)).not.toContain(
            'borderRadius',
        );
        block.styles.borderRadius = 6;
        const warning = checkBlock(block, [OUTLOOK_WINDOWS]).find(
            (w) => w.property === 'borderRadius',
        );
        expect(warning?.feature).toBe('css-border-radius');
        expect(warning?.level).toBe('n');
    });
});

describe('imageFormatFeature()', () => {
    it('reads the extension, ignoring query strings and case', () => {
        expect(imageFormatFeature('https://x.com/a.PNG?x=1#y')).toBe('image-png');
        expect(imageFormatFeature('https://x.com/a.jpeg')).toBe('image-jpg');
        expect(imageFormatFeature('data:image/png;base64,AAAA')).toBe('image-base64');
    });

    it('returns undefined when the format is unknown', () => {
        expect(imageFormatFeature('https://x.com/image')).toBeUndefined();
        expect(imageFormatFeature('https://x.com/a.xyz')).toBeUndefined();
    });
});

describe('button blocks', () => {
    it('warns that Outlook on Windows draws square corners, with the VML hint', () => {
        const warning = checkBlock(createButtonBlock(), [OUTLOOK_WINDOWS]).find(
            (w) => w.property === 'borderRadius',
        );
        expect(warning?.feature).toBe('css-border-radius');
        expect(warning?.level).toBe('n');
        expect(warning?.notes.join(' ')).toMatch(/VML/);
    });

    it('only checks bold and border radius when they are used', () => {
        const block = createButtonBlock();
        block.styles.bold = false;
        block.styles.borderRadius = 0;
        const properties = checkBlock(block, [OUTLOOK_WINDOWS]).map((w) => w.property);
        expect(properties).not.toContain('bold');
        expect(properties).not.toContain('borderRadius');
    });

    it('has nothing to report for Gmail on the web', () => {
        expect(checkBlock(createButtonBlock(), [GMAIL_DESKTOP])).toEqual([]);
    });
});
