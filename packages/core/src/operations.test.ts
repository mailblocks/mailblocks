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
    findBlock,
    moveBlock,
    removeBlock,
    removeRow,
    updateBlock,
    updateBlockStyles,
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
