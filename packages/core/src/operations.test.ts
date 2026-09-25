import { describe, expect, it } from 'vitest';
import {
    createEmptyDocument,
    createRow,
    createTextBlock,
    type EmailDocument,
    type TextBlock,
} from './model';
import {
    addBlock,
    addRow,
    duplicateBlock,
    findBlock,
    moveBlock,
    moveRow,
    removeBlock,
    removeRow,
    resizeColumn,
    setRowColumns,
    updateBlock,
    updateBlockStyles,
    updateDocumentStyles,
    updateRowStyles,
} from './operations';

/** A frozen two-column document so any mutation of the input throws. */
function fixture() {
    const doc = createEmptyDocument();
    const row = createRow(2);
    const [left, right] = row.columns as [(typeof row.columns)[0], (typeof row.columns)[0]];
    const a = createTextBlock('<p>a</p>');
    const b = createTextBlock('<p>b</p>');
    const c = createTextBlock('<p>c</p>');
    left.blocks.push(a, b);
    right.blocks.push(c);
    doc.rows.push(row);
    return { doc: deepFreeze(doc), row, left, right, a, b, c };
}

function deepFreeze<T>(value: T): T {
    if (value && typeof value === 'object') {
        Object.freeze(value);
        for (const child of Object.values(value)) deepFreeze(child);
    }
    return value;
}

function blockIds(doc: EmailDocument, columnId: string): string[] {
    for (const row of doc.rows) {
        const column = row.columns.find((c) => c.id === columnId);
        if (column) return column.blocks.map((block) => block.id);
    }
    throw new Error('column not found');
}

describe('findBlock()', () => {
    it('returns the block with its row, column and index', () => {
        const { doc, row, left, b } = fixture();
        expect(findBlock(doc, b.id)).toEqual({ block: b, row, column: left, index: 1 });
    });

    it('returns undefined for an unknown id', () => {
        expect(findBlock(fixture().doc, 'nope')).toBeUndefined();
    });
});

describe('addRow() / removeRow()', () => {
    it('appends a row by default and inserts at an index when given', () => {
        const { doc, row } = fixture();
        const first = createRow();
        const last = createRow();
        const next = addRow(addRow(doc, last), first, 0);
        expect(next.rows.map((r) => r.id)).toEqual([first.id, row.id, last.id]);
        expect(doc.rows).toHaveLength(1);
    });

    it('removes a row and throws for an unknown one', () => {
        const { doc, row } = fixture();
        expect(removeRow(doc, row.id).rows).toEqual([]);
        expect(() => removeRow(doc, 'nope')).toThrow(/Unknown row/);
    });
});

describe('addBlock() / removeBlock()', () => {
    it('appends to the column by default', () => {
        const { doc, right, c } = fixture();
        const d = createTextBlock('<p>d</p>');
        expect(blockIds(addBlock(doc, right.id, d), right.id)).toEqual([c.id, d.id]);
    });

    it('inserts at an index, clamped to the column length', () => {
        const { doc, left, a, b } = fixture();
        const d = createTextBlock('<p>d</p>');
        expect(blockIds(addBlock(doc, left.id, d, 1), left.id)).toEqual([a.id, d.id, b.id]);
        expect(blockIds(addBlock(doc, left.id, d, 99), left.id)).toEqual([a.id, b.id, d.id]);
    });

    it('removes a block and leaves the other column untouched', () => {
        const { doc, left, right, b } = fixture();
        const next = removeBlock(doc, b.id);
        expect(blockIds(next, left.id)).toHaveLength(1);
        expect(next.rows[0]?.columns[1]).toBe(right);
    });

    it('throws for unknown ids', () => {
        const { doc, a } = fixture();
        expect(() => addBlock(doc, 'nope', a)).toThrow(/Unknown column/);
        expect(() => removeBlock(doc, 'nope')).toThrow(/Unknown block/);
    });
});

describe('updateBlock() / updateBlockStyles()', () => {
    it('replaces the block and shares everything else', () => {
        const { doc, right, a } = fixture();
        const next = updateBlock(doc, a.id, (block) => ({ ...block, html: '<p>A</p>' }));
        expect((findBlock(next, a.id)?.block as TextBlock).html).toBe('<p>A</p>');
        expect(a.html).toBe('<p>a</p>');
        expect(next.rows[0]?.columns[1]).toBe(right);
    });

    it('merges a partial style patch', () => {
        const { doc, a } = fixture();
        const next = updateBlockStyles(doc, a.id, { fontSize: 20, textAlign: 'center' });
        const styles = (findBlock(next, a.id)?.block as TextBlock).styles;
        expect(styles?.fontSize).toBe(20);
        expect(styles?.textAlign).toBe('center');
        expect(styles?.color).toBe(a.styles.color);
    });
});

describe('moveBlock()', () => {
    it('moves a block to another column', () => {
        const { doc, left, right, a, b, c } = fixture();
        const next = moveBlock(doc, a.id, right.id, 0);
        expect(blockIds(next, left.id)).toEqual([b.id]);
        expect(blockIds(next, right.id)).toEqual([a.id, c.id]);
    });

    it('reorders inside the same column', () => {
        const { doc, left, a, b } = fixture();
        expect(blockIds(moveBlock(doc, a.id, left.id, 1), left.id)).toEqual([b.id, a.id]);
        expect(blockIds(moveBlock(doc, b.id, left.id, 0), left.id)).toEqual([b.id, a.id]);
    });
});

describe('duplicateBlock()', () => {
    it('puts a copy with a new id right after the block', () => {
        const { doc, left, a, b } = fixture();
        const { doc: next, block: copy } = duplicateBlock(doc, a.id);

        expect(blockIds(next, left.id)).toEqual([a.id, copy.id, b.id]);
        expect(copy.id).not.toBe(a.id);
        expect({ ...copy, id: a.id }).toEqual(a);
    });

    it('copies deeply, so editing the copy leaves the original alone', () => {
        const { doc, a } = fixture();
        const { doc: next, block: copy } = duplicateBlock(doc, a.id);
        const edited = updateBlockStyles<TextBlock>(next, copy.id, { fontSize: 30 });
        expect((findBlock(edited, a.id)?.block as TextBlock).styles.fontSize).toBe(16);
    });

    it('throws for an unknown block', () => {
        expect(() => duplicateBlock(fixture().doc, 'nope')).toThrow(/Unknown block/);
    });
});

describe('updateDocumentStyles()', () => {
    it('merges a partial patch into the document styles', () => {
        const { doc } = fixture();
        const next = updateDocumentStyles(doc, { contentWidth: 640 });
        expect(next.styles.contentWidth).toBe(640);
        expect(next.styles.fontFamily).toBe(doc.styles.fontFamily);
        expect(next.rows).toBe(doc.rows);
    });
});

describe('updateRowStyles()', () => {
    it('merges a patch into one row and can clear its background', () => {
        const { doc, row } = fixture();
        const coloured = updateRowStyles(doc, row.id, { backgroundColor: '#fff', paddingTop: 8 });
        expect(coloured.rows[0]?.styles).toEqual({
            backgroundColor: '#fff',
            paddingTop: 8,
            paddingBottom: 0,
        });
        const cleared = updateRowStyles(coloured, row.id, { backgroundColor: undefined });
        expect(cleared.rows[0]?.styles.backgroundColor).toBeUndefined();
    });

    it('throws for an unknown row', () => {
        expect(() => updateRowStyles(fixture().doc, 'nope', {})).toThrow(/Unknown row/);
    });
});

describe('moveRow()', () => {
    it('moves a row down and up', () => {
        const { doc, row } = fixture();
        const second = createRow();
        const third = createRow();
        const three = addRow(addRow(doc, second), third);

        expect(moveRow(three, row.id, 2).rows.map((r) => r.id)).toEqual([
            second.id,
            third.id,
            row.id,
        ]);
        expect(moveRow(three, third.id, 0).rows.map((r) => r.id)).toEqual([
            third.id,
            row.id,
            second.id,
        ]);
    });
});

describe('setRowColumns()', () => {
    it('adds empty columns and keeps the existing ones', () => {
        const { doc, row, left, right } = fixture();
        const next = setRowColumns(doc, row.id, [25, 25, 50]);
        const columns = next.rows[0]!.columns;

        expect(columns.map((c) => c.width)).toEqual([25, 25, 50]);
        expect(columns[0]?.id).toBe(left.id);
        expect(columns[1]?.id).toBe(right.id);
        expect(columns[0]?.blocks).toBe(left.blocks);
        expect(columns[2]?.blocks).toEqual([]);
    });

    it('moves the blocks of dropped columns into the last remaining one', () => {
        const { doc, row, left, a, b, c } = fixture();
        const next = setRowColumns(doc, row.id, [100]);
        const [only] = next.rows[0]!.columns;

        expect(only?.id).toBe(left.id);
        expect(only?.width).toBe(100);
        expect(only?.blocks.map((block) => block.id)).toEqual([a.id, b.id, c.id]);
    });

    it('rejects widths that do not add up to 100 or are not positive', () => {
        const { doc, row } = fixture();
        expect(() => setRowColumns(doc, row.id, [])).toThrow(RangeError);
        expect(() => setRowColumns(doc, row.id, [50, 40])).toThrow(RangeError);
        expect(() => setRowColumns(doc, row.id, [110, -10])).toThrow(RangeError);
        expect(() => setRowColumns(doc, row.id, [100 / 3, 100 / 3, 100 / 3])).not.toThrow();
    });
});

describe('resizeColumn()', () => {
    const widthsOf = (doc: EmailDocument) => doc.rows[0]!.columns.map((c) => c.width);

    it('takes the difference from the next column', () => {
        const { doc, row } = fixture();
        const three = setRowColumns(doc, row.id, [30, 30, 40]);
        expect(widthsOf(resizeColumn(three, row.id, 0, 45))).toEqual([45, 15, 40]);
    });

    it('takes it from the previous column when resizing the last one', () => {
        const { doc, row } = fixture();
        expect(widthsOf(resizeColumn(doc, row.id, 1, 70))).toEqual([30, 70]);
    });

    it('keeps both columns at the minimum width or more', () => {
        const { doc, row } = fixture();
        expect(widthsOf(resizeColumn(doc, row.id, 0, 99))).toEqual([90, 10]);
        expect(widthsOf(resizeColumn(doc, row.id, 0, 2))).toEqual([10, 90]);
        expect(widthsOf(resizeColumn(doc, row.id, 0, 99, 25))).toEqual([75, 25]);
    });

    it('keeps the blocks in their columns', () => {
        const { doc, row, a, c } = fixture();
        const next = resizeColumn(doc, row.id, 0, 60).rows[0]!.columns;
        expect(next[0]?.blocks[0]?.id).toBe(a.id);
        expect(next[1]?.blocks[0]?.id).toBe(c.id);
    });

    it('leaves a single-column row alone and rejects unknown columns', () => {
        const { doc, row } = fixture();
        const single = setRowColumns(doc, row.id, [100]);
        expect(resizeColumn(single, row.id, 0, 50)).toBe(single);
        expect(() => resizeColumn(doc, row.id, 5, 50)).toThrow(RangeError);
    });
});
