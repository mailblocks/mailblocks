import { describe, expect, it } from 'vitest';
import { createEmptyDocument, createRow, createTextBlock } from './model';

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
