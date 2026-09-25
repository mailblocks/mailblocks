import { describe, expect, it } from 'vitest';
import {
    createButtonBlock,
    createDividerBlock,
    createEmptyDocument,
    createImageBlock,
    createRow,
    createSpacerBlock,
    createTextBlock,
    type EmailDocument,
} from './model';
import { DocumentError, parseDocument, serializeDocument } from './serialize';

/** A document with every kind of block and every optional field set. */
function fullDocument(): EmailDocument {
    const doc = createEmptyDocument();
    doc.styles.darkBackgroundColor = '#000000';
    doc.styles.darkContentBackgroundColor = '#111111';
    const row = createRow(2);
    Object.assign(row.styles, {
        backgroundColor: '#eeeeee',
        darkBackgroundColor: '#222222',
        stackOnMobile: false,
    });
    const text = createTextBlock('<p>Hello <a href="https://example.com">you</a></p>');
    Object.assign(text.styles, { fontFamily: 'Georgia, serif', darkColor: '#ffffff' });
    const image = createImageBlock('https://example.com/a.png', 'A photo');
    Object.assign(image, { href: 'https://example.com', width: 200 });
    const button = createButtonBlock('Shop', 'https://example.com/shop');
    Object.assign(button.styles, { darkBackgroundColor: '#60a5fa', darkColor: '#000000' });
    const divider = createDividerBlock();
    divider.styles.darkColor = '#444444';
    row.columns[0]!.blocks.push(text, image);
    row.columns[1]!.blocks.push(button, divider, createSpacerBlock(12));
    doc.rows.push(row, createRow());
    return doc;
}

/** Reads `doc` after `change` was made to its JSON form, returning the error it raises. */
function errorFor(change: (json: any) => void): DocumentError {
    const json = JSON.parse(serializeDocument(fullDocument()));
    change(json);
    try {
        parseDocument(json);
    } catch (error) {
        if (error instanceof DocumentError) return error;
        throw error;
    }
    throw new Error('expected parseDocument to throw');
}

describe('serializeDocument() and parseDocument()', () => {
    it('give back the same document', () => {
        const doc = fullDocument();
        expect(parseDocument(serializeDocument(doc))).toEqual(doc);
    });

    it('write indented JSON that ends with a newline', () => {
        const json = serializeDocument(createEmptyDocument());
        expect(json).toMatch(/^\{\n {2}"version": 1,/);
        expect(json.endsWith('}\n')).toBe(true);
    });

    it('also read a value that is already parsed', () => {
        const doc = fullDocument();
        expect(parseDocument(structuredClone(doc))).toEqual(doc);
    });

    it('leave out fields the model does not know', () => {
        const json = JSON.parse(serializeDocument(fullDocument()));
        json.extra = 'x';
        json.rows[0].columns[0].blocks[0].styles.fontWeight = 900;
        const doc = parseDocument(json) as unknown as Record<string, unknown>;
        expect(doc.extra).toBeUndefined();
        expect(JSON.stringify(doc)).not.toContain('fontWeight');
    });

    it('treat null optional fields as unset', () => {
        const json = JSON.parse(serializeDocument(createEmptyDocument()));
        json.styles.darkBackgroundColor = null;
        expect('darkBackgroundColor' in parseDocument(json).styles).toBe(false);
    });
});

describe('parseDocument() refusals', () => {
    it('refuses text that is not JSON', () => {
        expect(() => parseDocument('{nope')).toThrow(new DocumentError('', 'not valid JSON'));
    });

    it('refuses what is not a mailblocks document, or a version it cannot read', () => {
        expect(() => parseDocument('[]')).toThrow('expected an object, got a list');
        expect(() => parseDocument('{"rows": []}')).toThrow(
            'version: missing, so this is not a mailblocks document',
        );
        expect(() => parseDocument('{"version": 2}')).toThrow(
            'version: 2 is not a version this mailblocks can read',
        );
    });

    it('says where the problem is and what was expected', () => {
        expect(
            errorFor((json) => (json.rows[0].columns[1].blocks[0].styles.fontSize = '16px')),
        ).toMatchObject({
            path: 'rows[0].columns[1].blocks[0].styles.fontSize',
            message: 'rows[0].columns[1].blocks[0].styles.fontSize: expected a number, got "16px"',
        });
        expect(errorFor((json) => delete json.styles.fontFamily).message).toBe(
            'styles.fontFamily: expected text, got nothing',
        );
        expect(errorFor((json) => (json.rows[0].columns[0].blocks[0].type = 'video')).message).toBe(
            'rows[0].columns[0].blocks[0].type: "video" is not a block type; expected one of text, image, button, divider, spacer',
        );
        expect(
            errorFor((json) => (json.rows[0].columns[0].blocks[0].styles.textAlign = 'justify'))
                .message,
        ).toBe(
            'rows[0].columns[0].blocks[0].styles.textAlign: expected one of left, center, right, got "justify"',
        );
    });

    it('refuses negative sizes, empty rows and columns without width', () => {
        expect(errorFor((json) => (json.rows[0].styles.paddingTop = -4)).message).toBe(
            'rows[0].styles.paddingTop: must not be negative',
        );
        expect(errorFor((json) => (json.rows[1].columns = [])).message).toBe(
            'rows[1].columns: a row needs a column',
        );
        expect(errorFor((json) => (json.rows[0].columns[0].width = 0)).message).toBe(
            'rows[0].columns[0].width: must be more than 0',
        );
        expect(errorFor((json) => (json.styles.contentWidth = Infinity)).path).toBe(
            'styles.contentWidth',
        );
    });
});

describe('parseDocument() repairs', () => {
    it('gives new ids to ids used twice, and to empty ones', () => {
        const json = JSON.parse(serializeDocument(fullDocument()));
        const [first, second] = json.rows[0].columns;
        second.blocks[0].id = first.blocks[0].id;
        json.rows[1].id = '';
        const doc = parseDocument(json);

        const ids = [
            ...doc.rows.map((row) => row.id),
            ...doc.rows.flatMap((row) => row.columns.map((column) => column.id)),
            ...doc.rows.flatMap((row) =>
                row.columns.flatMap((column) => column.blocks.map((block) => block.id)),
            ),
        ];
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids).not.toContain('');
        expect(doc.rows[0]!.columns[0]!.blocks[0]!.id).toBe(first.blocks[0].id);
    });

    it('scales column widths that do not add up to 100', () => {
        const json = JSON.parse(serializeDocument(fullDocument()));
        json.rows[0].columns[0].width = 1;
        json.rows[0].columns[1].width = 3;
        const [a, b] = parseDocument(json).rows[0]!.columns;
        expect([a!.width, b!.width]).toEqual([25, 75]);
    });
});

describe('parseDocument() options', () => {
    it("runs text blocks' HTML through options.html, and nothing else", () => {
        const doc = fullDocument();
        const seen: string[] = [];
        const read = parseDocument(serializeDocument(doc), {
            html: (html) => {
                seen.push(html);
                return html.toUpperCase();
            },
        });
        expect(seen).toEqual(['<p>Hello <a href="https://example.com">you</a></p>']);
        const text = read.rows[0]!.columns[0]!.blocks[0]!;
        expect(text.type === 'text' && text.html).toBe(
            '<P>HELLO <A HREF="HTTPS://EXAMPLE.COM">YOU</A></P>',
        );
        const button = read.rows[0]!.columns[1]!.blocks[0]!;
        expect(button.type === 'button' && button.text).toBe('Shop');
    });
});
