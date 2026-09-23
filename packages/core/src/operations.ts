import type { Block, Column, EmailDocument, Row } from './model';

/**
 * Pure operations on a document. Every function returns a new document and
 * never touches the one it was given, copying only the rows, columns and
 * blocks on the path it changes. That is what UI frameworks need to detect
 * changes cheaply, and what makes undo a matter of keeping old documents.
 *
 * Ids that do not exist in the document are programming errors and throw.
 */

/** Where a block lives inside a document. */
export interface BlockLocation {
    block: Block;
    row: Row;
    column: Column;
    /** Position of the block inside its column. */
    index: number;
}

export function findBlock(doc: EmailDocument, blockId: string): BlockLocation | undefined {
    for (const row of doc.rows) {
        for (const column of row.columns) {
            const index = column.blocks.findIndex((block) => block.id === blockId);
            const block = column.blocks[index];
            if (block) return { block, row, column, index };
        }
    }
    return undefined;
}

export function addRow(doc: EmailDocument, row: Row, index = doc.rows.length): EmailDocument {
    return { ...doc, rows: insertAt(doc.rows, index, row) };
}

export function removeRow(doc: EmailDocument, rowId: string): EmailDocument {
    requireRow(doc, rowId);
    return { ...doc, rows: doc.rows.filter((row) => row.id !== rowId) };
}

/** Inserts `block` into the column, at the end unless `index` is given. */
export function addBlock(
    doc: EmailDocument,
    columnId: string,
    block: Block,
    index?: number,
): EmailDocument {
    return updateColumn(doc, columnId, (column) => ({
        ...column,
        blocks: insertAt(column.blocks, index ?? column.blocks.length, block),
    }));
}

export function removeBlock(doc: EmailDocument, blockId: string): EmailDocument {
    const { column } = requireBlock(doc, blockId);
    return updateColumn(doc, column.id, (c) => ({
        ...c,
        blocks: c.blocks.filter((block) => block.id !== blockId),
    }));
}

/** Replaces a block with whatever `update` returns for it. */
export function updateBlock(
    doc: EmailDocument,
    blockId: string,
    update: (block: Block) => Block,
): EmailDocument {
    const { column } = requireBlock(doc, blockId);
    return updateColumn(doc, column.id, (c) => ({
        ...c,
        blocks: c.blocks.map((block) => (block.id === blockId ? update(block) : block)),
    }));
}

/** Merges `styles` into the block's styles. */
export function updateBlockStyles<B extends Block>(
    doc: EmailDocument,
    blockId: string,
    styles: Partial<B['styles']>,
): EmailDocument {
    return updateBlock(doc, blockId, (block) => ({
        ...block,
        styles: { ...block.styles, ...styles },
    }));
}

/**
 * Moves a block to `index` inside the column `columnId`, which may be the
 * column it is already in. `index` counts positions in the target column
 * after the block has been taken out of its current one.
 */
export function moveBlock(
    doc: EmailDocument,
    blockId: string,
    columnId: string,
    index: number,
): EmailDocument {
    const { block } = requireBlock(doc, blockId);
    return addBlock(removeBlock(doc, blockId), columnId, block, index);
}

// ---------------------------------------------------------------------------

function updateColumn(
    doc: EmailDocument,
    columnId: string,
    update: (column: Column) => Column,
): EmailDocument {
    const row = doc.rows.find((r) => r.columns.some((c) => c.id === columnId));
    if (!row) throw new Error(`Unknown column: "${columnId}"`);
    return {
        ...doc,
        rows: doc.rows.map((r) =>
            r === row
                ? { ...r, columns: r.columns.map((c) => (c.id === columnId ? update(c) : c)) }
                : r,
        ),
    };
}

function requireRow(doc: EmailDocument, rowId: string): Row {
    const row = doc.rows.find((r) => r.id === rowId);
    if (!row) throw new Error(`Unknown row: "${rowId}"`);
    return row;
}

function requireBlock(doc: EmailDocument, blockId: string): BlockLocation {
    const location = findBlock(doc, blockId);
    if (!location) throw new Error(`Unknown block: "${blockId}"`);
    return location;
}

function insertAt<T>(items: readonly T[], index: number, item: T): T[] {
    const at = Math.max(0, Math.min(index, items.length));
    return [...items.slice(0, at), item, ...items.slice(at)];
}
