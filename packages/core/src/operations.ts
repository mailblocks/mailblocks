import {
    createId,
    type Block,
    type Column,
    type DocumentStyles,
    type EmailDocument,
    type Row,
    type RowStyles,
} from './model';

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
    return updateBlock(
        doc,
        blockId,
        (block) => ({ ...block, styles: { ...block.styles, ...styles } }) as Block,
    );
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

/** Merges `styles` into the document styles. */
export function updateDocumentStyles(
    doc: EmailDocument,
    styles: Partial<DocumentStyles>,
): EmailDocument {
    return { ...doc, styles: { ...doc.styles, ...styles } };
}

/** Merges `styles` into a row's styles. */
export function updateRowStyles(
    doc: EmailDocument,
    rowId: string,
    styles: Partial<RowStyles>,
): EmailDocument {
    requireRow(doc, rowId);
    return {
        ...doc,
        rows: doc.rows.map((row) =>
            row.id === rowId ? { ...row, styles: { ...row.styles, ...styles } } : row,
        ),
    };
}

/** Moves a row to `index`, counted after it has been taken out of its current place. */
export function moveRow(doc: EmailDocument, rowId: string, index: number): EmailDocument {
    const row = requireRow(doc, rowId);
    return addRow(removeRow(doc, rowId), row, index);
}

/**
 * Gives a row one column per entry of `widths` (percentages adding up to 100).
 * Existing columns keep their ids and blocks in order; new ones start empty.
 * When the row gets fewer columns, the blocks of the dropped columns move to
 * the end of the last remaining one, so no content is lost.
 */
export function setRowColumns(doc: EmailDocument, rowId: string, widths: number[]): EmailDocument {
    const total = widths.reduce((sum, width) => sum + width, 0);
    if (
        widths.length === 0 ||
        widths.some((width) => !(width > 0)) ||
        Math.abs(total - 100) > 0.5
    ) {
        throw new RangeError(`Column widths must be positive and add up to 100, got [${widths}]`);
    }
    const row = requireRow(doc, rowId);
    const columns: Column[] = widths.map((width, i) => {
        const existing = row.columns[i];
        return existing ? { ...existing, width } : { id: createId(), width, blocks: [] };
    });
    const dropped = row.columns.slice(widths.length).flatMap((column) => column.blocks);
    if (dropped.length > 0) {
        const last = columns[columns.length - 1]!;
        columns[columns.length - 1] = { ...last, blocks: [...last.blocks, ...dropped] };
    }
    return { ...doc, rows: doc.rows.map((r) => (r.id === rowId ? { ...r, columns } : r)) };
}

/**
 * Sets the width of the column at `index` and gives or takes the difference
 * from its neighbour (the next column, or the previous one for the last
 * column), so the widths still add up to 100. No column goes below
 * `minWidth` percent. A single-column row is left as it is.
 */
export function resizeColumn(
    doc: EmailDocument,
    rowId: string,
    index: number,
    width: number,
    minWidth = 10,
): EmailDocument {
    const row = requireRow(doc, rowId);
    const widths = row.columns.map((column) => column.width);
    if (!Number.isInteger(index) || index < 0 || index >= widths.length) {
        throw new RangeError(`Row has no column ${index}`);
    }
    if (widths.length === 1) return doc;
    const neighbour = index < widths.length - 1 ? index + 1 : index - 1;
    const pair = widths[index]! + widths[neighbour]!;
    const clamped = Math.min(Math.max(width, minWidth), pair - minWidth);
    widths[index] = clamped;
    widths[neighbour] = pair - clamped;
    return setRowColumns(doc, rowId, widths);
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
