import { describe, expect, it } from 'vitest';
import {
    createButtonBlock,
    createDividerBlock,
    createEmptyDocument,
    createImageBlock,
    createRow,
    createSpacerBlock,
    createTextBlock,
} from './model';

describe('createEmptyDocument()', () => {
    it('creates a versioned document with no rows and sensible defaults', () => {
        const doc = createEmptyDocument();
        expect(doc.version).toBe(1);
        expect(doc.rows).toEqual([]);
        expect(doc.styles.contentWidth).toBe(600);
    });

    it('gives every document its own id', () => {
        expect(createEmptyDocument().id).not.toBe(createEmptyDocument().id);
    });
});

describe('createRow()', () => {
    it('defaults to a single full-width column', () => {
        const row = createRow();
        expect(row.columns).toHaveLength(1);
        expect(row.columns[0]?.width).toBe(100);
    });

    it('splits the width evenly between columns', () => {
        const row = createRow(3);
        expect(row.columns.map((column) => column.width)).toEqual([100 / 3, 100 / 3, 100 / 3]);
        expect(row.columns.reduce((sum, column) => sum + column.width, 0)).toBeCloseTo(100);
    });

    it('rejects a row without columns', () => {
        expect(() => createRow(0)).toThrow(RangeError);
        expect(() => createRow(1.5)).toThrow(RangeError);
    });
});

describe('createTextBlock()', () => {
    it('creates an empty paragraph by default', () => {
        const block = createTextBlock();
        expect(block.type).toBe('text');
        expect(block.html).toBe('<p></p>');
    });

    it('keeps the given html', () => {
        expect(createTextBlock('<p>Hello</p>').html).toBe('<p>Hello</p>');
    });
});

describe('createImageBlock()', () => {
    it('creates a centred image with no source by default', () => {
        const block = createImageBlock();
        expect(block.type).toBe('image');
        expect(block.src).toBe('');
        expect(block.styles.align).toBe('center');
        expect(block.width).toBeUndefined();
    });

    it('keeps the given source and alt text', () => {
        const block = createImageBlock('https://example.com/a.png', 'Logo');
        expect(block.src).toBe('https://example.com/a.png');
        expect(block.alt).toBe('Logo');
    });
});

describe('createButtonBlock()', () => {
    it('creates a centred, bold, rounded button with a label and no link', () => {
        const block = createButtonBlock();
        expect(block.type).toBe('button');
        expect(block.text).toBe('Button');
        expect(block.href).toBe('');
        expect(block.styles.align).toBe('center');
        expect(block.styles.bold).toBe(true);
        expect(block.styles.borderRadius).toBeGreaterThan(0);
    });

    it('keeps the given label and link', () => {
        const block = createButtonBlock('Buy now', 'https://example.com');
        expect(block.text).toBe('Buy now');
        expect(block.href).toBe('https://example.com');
    });
});

describe('createDividerBlock()', () => {
    it('creates a thin, full-width, solid grey line', () => {
        const block = createDividerBlock();
        expect(block.type).toBe('divider');
        expect(block.styles.thickness).toBe(1);
        expect(block.styles.lineStyle).toBe('solid');
        expect(block.styles.width).toBe(100);
    });
});

describe('createSpacerBlock()', () => {
    it('defaults to 24 pixels and keeps a given height', () => {
        expect(createSpacerBlock().styles.height).toBe(24);
        expect(createSpacerBlock(40).styles.height).toBe(40);
    });
});
