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
 * Saving a document as JSON and reading it back. What is read is checked
 * field by field, because a file can come from anywhere: a document that
 * does not have the right shape is refused with the place and reason, and
 * fields the model does not know are left out.
 */

/** A document as JSON text, indented for people and version control. */
export function serializeDocument(doc: EmailDocument): string {
    return `${JSON.stringify(doc, null, 2)}\n`;
}

/** Why a document could not be read, and where: `path` is like `rows[0].columns[1].width`. */
export class DocumentError extends Error {
    constructor(
        readonly path: string,
        readonly reason: string,
    ) {
        super(path ? `${path}: ${reason}` : reason);
        this.name = 'DocumentError';
    }
}

/**
 * Reads a document from JSON text, or from a value already parsed.
 *
 * Throws a {@link DocumentError} when it is not a document this version can
 * read. Some slips are repaired instead: ids used twice get new ones, and
 * column widths that do not add up to 100 are scaled so they do.
 *
 * Text blocks' HTML is only checked to be text. Pass `options.html` to clean
 * it, such as `cleanTextHtml` from `@mailblocks/react`, when the file is not
 * trusted.
 */
export function parseDocument(
    input: unknown,
    options: { html?: (html: string) => string } = {},
): EmailDocument {
    let value = input;
    if (typeof input === 'string') {
        try {
            value = JSON.parse(input);
        } catch {
            throw new DocumentError('', 'not valid JSON');
        }
    }
    const reader = new Reader(options.html ?? ((html) => html));
    return reader.document(value);
}

type Align = 'left' | 'center' | 'right';
const ALIGNS: readonly Align[] = ['left', 'center', 'right'];
const LINE_STYLES = ['solid', 'dashed', 'dotted'] as const;
const BLOCK_TYPES: readonly Block['type'][] = ['text', 'image', 'button', 'divider', 'spacer'];

/** Reads each part of a document, keeping track of the ids seen so far. */
class Reader {
    private readonly ids = new Set<string>();

    constructor(private readonly html: (html: string) => string) {}

    document(value: unknown): EmailDocument {
        const o = object(value, '');
        if (o.version !== 1) {
            throw new DocumentError(
                'version',
                o.version === undefined
                    ? 'missing, so this is not a mailblocks document'
                    : `${JSON.stringify(o.version)} is not a version this mailblocks can read`,
            );
        }
        return {
            version: 1,
            id: this.id(o.id, 'id'),
            styles: documentStyles(o.styles, 'styles'),
            rows: array(o.rows, 'rows').map((row, i) => this.row(row, `rows[${i}]`)),
        };
    }

    private row(value: unknown, path: string): Row {
        const o = object(value, path);
        const columns = array(o.columns, `${path}.columns`).map((column, i) =>
            this.column(column, `${path}.columns[${i}]`),
        );
        if (columns.length === 0)
            throw new DocumentError(`${path}.columns`, 'a row needs a column');
        return {
            id: this.id(o.id, `${path}.id`),
            columns: fitWidths(columns),
            styles: rowStyles(o.styles, `${path}.styles`),
        };
    }

    private column(value: unknown, path: string): Column {
        const o = object(value, path);
        const width = number(o.width, `${path}.width`);
        if (width <= 0) throw new DocumentError(`${path}.width`, 'must be more than 0');
        return {
            id: this.id(o.id, `${path}.id`),
            width,
            blocks: array(o.blocks, `${path}.blocks`).map((block, i) =>
                this.block(block, `${path}.blocks[${i}]`),
            ),
        };
    }

    private block(value: unknown, path: string): Block {
        const o = object(value, path);
        const id = this.id(o.id, `${path}.id`);
        const s = object(o.styles, `${path}.styles`);
        const sp = `${path}.styles`;
        // Every block but the spacer has a padding on its four sides.
        const padding = () => ({
            paddingTop: size(s.paddingTop, `${sp}.paddingTop`),
            paddingRight: size(s.paddingRight, `${sp}.paddingRight`),
            paddingBottom: size(s.paddingBottom, `${sp}.paddingBottom`),
            paddingLeft: size(s.paddingLeft, `${sp}.paddingLeft`),
        });
        switch (o.type) {
            case 'text':
                return {
                    id,
                    type: 'text',
                    html: this.html(string(o.html, `${path}.html`)),
                    styles: {
                        ...optional('fontFamily', s.fontFamily, `${sp}.fontFamily`, string),
                        fontSize: size(s.fontSize, `${sp}.fontSize`),
                        lineHeight: number(s.lineHeight, `${sp}.lineHeight`),
                        color: string(s.color, `${sp}.color`),
                        ...optional('darkColor', s.darkColor, `${sp}.darkColor`, string),
                        textAlign: oneOf(s.textAlign, ALIGNS, `${sp}.textAlign`),
                        ...padding(),
                    },
                };
            case 'image':
                return {
                    id,
                    type: 'image',
                    src: string(o.src, `${path}.src`),
                    alt: string(o.alt, `${path}.alt`),
                    ...optional('href', o.href, `${path}.href`, string),
                    ...optional('width', o.width, `${path}.width`, size),
                    styles: {
                        align: oneOf(s.align, ALIGNS, `${sp}.align`),
                        borderRadius: size(s.borderRadius, `${sp}.borderRadius`),
                        ...padding(),
                    },
                };
            case 'button':
                return {
                    id,
                    type: 'button',
                    text: string(o.text, `${path}.text`),
                    href: string(o.href, `${path}.href`),
                    styles: {
                        align: oneOf(s.align, ALIGNS, `${sp}.align`),
                        backgroundColor: string(s.backgroundColor, `${sp}.backgroundColor`),
                        color: string(s.color, `${sp}.color`),
                        ...optional(
                            'darkBackgroundColor',
                            s.darkBackgroundColor,
                            `${sp}.darkBackgroundColor`,
                            string,
                        ),
                        ...optional('darkColor', s.darkColor, `${sp}.darkColor`, string),
                        ...optional('fontFamily', s.fontFamily, `${sp}.fontFamily`, string),
                        fontSize: size(s.fontSize, `${sp}.fontSize`),
                        bold: boolean(s.bold, `${sp}.bold`),
                        borderRadius: size(s.borderRadius, `${sp}.borderRadius`),
                        innerPaddingY: size(s.innerPaddingY, `${sp}.innerPaddingY`),
                        innerPaddingX: size(s.innerPaddingX, `${sp}.innerPaddingX`),
                        ...padding(),
                    },
                };
            case 'divider':
                return {
                    id,
                    type: 'divider',
                    styles: {
                        color: string(s.color, `${sp}.color`),
                        ...optional('darkColor', s.darkColor, `${sp}.darkColor`, string),
                        thickness: size(s.thickness, `${sp}.thickness`),
                        lineStyle: oneOf(s.lineStyle, LINE_STYLES, `${sp}.lineStyle`),
                        width: size(s.width, `${sp}.width`),
                        align: oneOf(s.align, ALIGNS, `${sp}.align`),
                        ...padding(),
                    },
                };
            case 'spacer':
                return { id, type: 'spacer', styles: { height: size(s.height, `${sp}.height`) } };
            default:
                throw new DocumentError(
                    `${path}.type`,
                    `${JSON.stringify(o.type)} is not a block type; expected one of ${BLOCK_TYPES.join(', ')}`,
                );
        }
    }

    /** A string id, or a new one when it was already used. */
    private id(value: unknown, path: string): string {
        let id = string(value, path);
        if (!id || this.ids.has(id)) id = createId();
        this.ids.add(id);
        return id;
    }
}

function documentStyles(value: unknown, path: string): DocumentStyles {
    const s = object(value, path);
    const contentWidth = size(s.contentWidth, `${path}.contentWidth`);
    if (contentWidth < 1) throw new DocumentError(`${path}.contentWidth`, 'must be at least 1');
    return {
        backgroundColor: string(s.backgroundColor, `${path}.backgroundColor`),
        contentWidth,
        contentBackgroundColor: string(s.contentBackgroundColor, `${path}.contentBackgroundColor`),
        fontFamily: string(s.fontFamily, `${path}.fontFamily`),
        ...optional(
            'darkBackgroundColor',
            s.darkBackgroundColor,
            `${path}.darkBackgroundColor`,
            string,
        ),
        ...optional(
            'darkContentBackgroundColor',
            s.darkContentBackgroundColor,
            `${path}.darkContentBackgroundColor`,
            string,
        ),
    };
}

function rowStyles(value: unknown, path: string): RowStyles {
    const s = object(value, path);
    return {
        ...optional('backgroundColor', s.backgroundColor, `${path}.backgroundColor`, string),
        ...optional(
            'darkBackgroundColor',
            s.darkBackgroundColor,
            `${path}.darkBackgroundColor`,
            string,
        ),
        paddingTop: size(s.paddingTop, `${path}.paddingTop`),
        paddingBottom: size(s.paddingBottom, `${path}.paddingBottom`),
        ...optional('stackOnMobile', s.stackOnMobile, `${path}.stackOnMobile`, boolean),
    };
}

/** Scales column widths so they add up to 100, which the model requires. */
function fitWidths(columns: Column[]): Column[] {
    const total = columns.reduce((sum, column) => sum + column.width, 0);
    if (Math.abs(total - 100) <= 0.5) return columns;
    return columns.map((column) => ({ ...column, width: (column.width * 100) / total }));
}

// --- Checks for single values ---------------------------------------------------

function object(value: unknown, path: string): Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new DocumentError(path, `expected an object, got ${describe(value)}`);
    }
    return value as Record<string, unknown>;
}

function array(value: unknown, path: string): unknown[] {
    if (!Array.isArray(value))
        throw new DocumentError(path, `expected a list, got ${describe(value)}`);
    return value;
}

function string(value: unknown, path: string): string {
    if (typeof value !== 'string')
        throw new DocumentError(path, `expected text, got ${describe(value)}`);
    return value;
}

function number(value: unknown, path: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new DocumentError(path, `expected a number, got ${describe(value)}`);
    }
    return value;
}

/** A number of pixels or a percentage: not negative. */
function size(value: unknown, path: string): number {
    const n = number(value, path);
    if (n < 0) throw new DocumentError(path, 'must not be negative');
    return n;
}

function boolean(value: unknown, path: string): boolean {
    if (typeof value !== 'boolean') {
        throw new DocumentError(path, `expected true or false, got ${describe(value)}`);
    }
    return value;
}

function oneOf<T extends string>(value: unknown, options: readonly T[], path: string): T {
    if (typeof value !== 'string' || !options.includes(value as T)) {
        throw new DocumentError(
            path,
            `expected one of ${options.join(', ')}, got ${describe(value)}`,
        );
    }
    return value as T;
}

/** `{ key: value }` when the value is there, `{}` when it is not, so the key stays out of the result. */
function optional<K extends string, T>(
    key: K,
    value: unknown,
    path: string,
    read: (value: unknown, path: string) => T,
): { [P in K]?: T } {
    return value === undefined || value === null
        ? {}
        : ({ [key]: read(value, path) } as { [P in K]?: T });
}

function describe(value: unknown): string {
    if (value === undefined) return 'nothing';
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'a list';
    if (typeof value === 'string')
        return JSON.stringify(value.length > 40 ? `${value.slice(0, 40)}…` : value);
    if (typeof value === 'object') return 'an object';
    return String(value);
}
