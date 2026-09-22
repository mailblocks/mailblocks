/**
 * The email document model.
 *
 * An email is a vertical stack of rows. Each row splits its width into columns,
 * and each column holds a vertical stack of blocks. This mirrors the nested
 * `<table>` layout that email clients can actually render.
 */

export interface EmailDocument {
    /** Schema version, bumped when the shape of the document changes. */
    version: 1;
    id: string;
    styles: DocumentStyles;
    rows: Row[];
}

export interface DocumentStyles {
    /** Background colour of the whole email, behind the content. */
    backgroundColor: string;
    /** Width of the content area in pixels. 600 is the email industry default. */
    contentWidth: number;
    /** Font stack used by text that does not set its own. */
    fontFamily: string;
}

export interface Row {
    id: string;
    columns: Column[];
    styles: RowStyles;
}

export interface RowStyles {
    backgroundColor?: string;
    paddingTop: number;
    paddingBottom: number;
}

export interface Column {
    id: string;
    /** Share of the row width in percent. The widths of a row's columns add up to 100. */
    width: number;
    blocks: Block[];
}

/** All block kinds. Only `text` exists for now; more will join this union. */
export type Block = TextBlock;

export interface TextBlock {
    id: string;
    type: 'text';
    /** Inline HTML of the paragraph(s). Sanitised on export, not here. */
    html: string;
    styles: TextStyles;
}

export interface TextStyles {
    fontFamily?: string;
    fontSize: number;
    lineHeight: number;
    color: string;
    textAlign: 'left' | 'center' | 'right';
    paddingTop: number;
    paddingRight: number;
    paddingBottom: number;
    paddingLeft: number;
}

export function createId(): string {
    return crypto.randomUUID();
}

export function createEmptyDocument(): EmailDocument {
    return {
        version: 1,
        id: createId(),
        styles: {
            backgroundColor: '#f4f4f4',
            contentWidth: 600,
            fontFamily: 'Arial, Helvetica, sans-serif',
        },
        rows: [],
    };
}

/** Creates a row with `columnCount` equal-width empty columns. */
export function createRow(columnCount = 1): Row {
    if (!Number.isInteger(columnCount) || columnCount < 1) {
        throw new RangeError(`A row needs at least one column, got ${columnCount}`);
    }
    const width = 100 / columnCount;
    return {
        id: createId(),
        columns: Array.from({ length: columnCount }, () => ({ id: createId(), width, blocks: [] })),
        styles: { paddingTop: 0, paddingBottom: 0 },
    };
}

export function createTextBlock(html = '<p></p>'): TextBlock {
    return {
        id: createId(),
        type: 'text',
        html,
        styles: {
            fontSize: 16,
            lineHeight: 1.5,
            color: '#000000',
            textAlign: 'left',
            paddingTop: 10,
            paddingRight: 25,
            paddingBottom: 10,
            paddingLeft: 25,
        },
    };
}
