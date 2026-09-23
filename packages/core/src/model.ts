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
    /** Background colour of the content area. Rows without their own colour show this. */
    contentBackgroundColor: string;
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

/** All block kinds, discriminated by `type`. */
export type Block = TextBlock | ImageBlock | ButtonBlock;

export interface TextBlock {
    id: string;
    type: 'text';
    /**
     * Inline HTML of the paragraph(s), rendered as-is on export. Sanitise it
     * before storing when it comes from an untrusted source.
     */
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

export interface ImageBlock {
    id: string;
    type: 'image';
    /** Absolute URL of the image. Email clients load it from there; nothing is embedded. */
    src: string;
    /** Shown while the image loads or when images are blocked, and read by screen readers. */
    alt: string;
    /** Link the image opens, if any. */
    href?: string;
    /** Rendered width in pixels. Leave unset to fill the column. */
    width?: number;
    styles: ImageStyles;
}

export interface ImageStyles {
    align: 'left' | 'center' | 'right';
    borderRadius: number;
    paddingTop: number;
    paddingRight: number;
    paddingBottom: number;
    paddingLeft: number;
}

export interface ButtonBlock {
    id: string;
    type: 'button';
    /** The label, as plain text. */
    text: string;
    /** Where the button links to. */
    href: string;
    styles: ButtonStyles;
}

export interface ButtonStyles {
    align: 'left' | 'center' | 'right';
    backgroundColor: string;
    color: string;
    fontFamily?: string;
    fontSize: number;
    bold: boolean;
    borderRadius: number;
    /** Space between the label and the top and bottom edges of the button. */
    innerPaddingY: number;
    /** Space between the label and the left and right edges of the button. */
    innerPaddingX: number;
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
            contentBackgroundColor: '#ffffff',
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

export function createImageBlock(src = '', alt = ''): ImageBlock {
    return {
        id: createId(),
        type: 'image',
        src,
        alt,
        styles: {
            align: 'center',
            borderRadius: 0,
            paddingTop: 10,
            paddingRight: 25,
            paddingBottom: 10,
            paddingLeft: 25,
        },
    };
}

export function createButtonBlock(text = 'Button', href = ''): ButtonBlock {
    return {
        id: createId(),
        type: 'button',
        text,
        href,
        styles: {
            align: 'center',
            backgroundColor: '#2563eb',
            color: '#ffffff',
            fontSize: 16,
            bold: true,
            borderRadius: 4,
            innerPaddingY: 12,
            innerPaddingX: 24,
            paddingTop: 10,
            paddingRight: 25,
            paddingBottom: 10,
            paddingLeft: 25,
        },
    };
}
