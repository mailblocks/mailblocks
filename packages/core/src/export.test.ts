import { describe, expect, it } from 'vitest';
import { exportHtml } from './export';
import {
    createEmptyDocument,
    createImageBlock,
    createRow,
    createTextBlock,
    type EmailDocument,
} from './model';

function documentWith(...blocks: ReturnType<typeof createTextBlock>[]): EmailDocument {
    const doc = createEmptyDocument();
    const row = createRow();
    row.columns[0]?.blocks.push(...blocks);
    doc.rows.push(row);
    return doc;
}

describe('exportHtml()', () => {
    it('renders a complete HTML document', () => {
        const html = exportHtml(createEmptyDocument());
        expect(html).toMatch(
            /^<!DOCTYPE html PUBLIC "-\/\/W3C\/\/DTD XHTML 1.0 Transitional\/\/EN"/,
        );
        expect(html).toContain(
            '<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />',
        );
        expect(html).toContain('<!--[if mso]>');
        expect(html.trimEnd()).toMatch(/<\/html>$/);
    });

    it('applies the document styles', () => {
        const doc = createEmptyDocument();
        doc.styles.backgroundColor = '#123456';
        doc.styles.contentWidth = 640;
        doc.styles.fontFamily = 'Georgia, serif';
        const html = exportHtml(doc);

        expect(html).toContain('<body style="margin:0;padding:0;background-color:#123456;">');
        expect(html).toContain('width="640"');
        expect(html).toContain('max-width:640px');
        expect(html).toContain('font-family:Georgia, serif;');
    });

    it('renders text blocks with inline styles in pixels', () => {
        const block = createTextBlock('<p>Hello <strong>world</strong></p>');
        const html = exportHtml(documentWith(block));

        expect(html).toContain('<p>Hello <strong>world</strong></p>');
        expect(html).toContain('padding:10px 25px 10px 25px;');
        expect(html).toContain('font-size:16px;');
        // 16px * 1.5 line height, rounded to whole pixels for Outlook
        expect(html).toContain('line-height:24px;mso-line-height-rule:exactly;');
        expect(html).toContain('color:#000000;');
        expect(html).toContain('align="left"');
        expect(html).toContain('text-align:left;');
    });

    it('lets a text block override the document font', () => {
        const block = createTextBlock();
        block.styles.fontFamily = 'Verdana, sans-serif';
        expect(exportHtml(documentWith(block))).toContain('font-family:Verdana, sans-serif;');
    });

    it('renders columns as cells with percentage widths', () => {
        const doc = createEmptyDocument();
        doc.rows.push(createRow(3));
        const html = exportHtml(doc);

        expect(html.match(/<td valign="top" width="33.33%" style="width:33.33%;">/g)).toHaveLength(
            3,
        );
    });

    it('applies row background and vertical padding', () => {
        const doc = createEmptyDocument();
        const row = createRow();
        row.styles.backgroundColor = '#ffffff';
        row.styles.paddingTop = 20;
        row.styles.paddingBottom = 30;
        doc.rows.push(row);

        expect(exportHtml(doc)).toContain(
            '<td style="padding:20px 0 30px 0;background-color:#ffffff;">',
        );
    });

    it('escapes style values used in attributes', () => {
        const doc = createEmptyDocument();
        doc.styles.fontFamily = '"Helvetica Neue", Arial';
        const html = exportHtml(doc);

        expect(html).toContain('font-family:&quot;Helvetica Neue&quot;, Arial;');
        expect(html).not.toContain('font-family:"Helvetica');
    });
});

describe('exportHtml() with image blocks', () => {
    function imageDocument(block: ReturnType<typeof createImageBlock>, columns = 1) {
        const doc = createEmptyDocument();
        const row = createRow(columns);
        row.columns[0]?.blocks.push(block);
        doc.rows.push(row);
        return doc;
    }

    it('renders an image sized to the column in pixels', () => {
        const block = createImageBlock('https://example.com/a.png', 'Logo');
        const html = exportHtml(imageDocument(block));
        // 600px column minus 25px padding on each side
        expect(html).toContain(
            '<img src="https://example.com/a.png" alt="Logo" width="550" style="display:block;width:550px;max-width:100%;height:auto;border:0;margin:0 auto;" />',
        );
        expect(html).toContain('<td align="center" style="padding:10px 25px 10px 25px;">');
    });

    it('never renders wider than the column', () => {
        const block = createImageBlock('https://example.com/a.png', '');
        block.width = 900;
        expect(exportHtml(imageDocument(block, 2))).toContain('width="250"');
    });

    it('uses the given width when it fits', () => {
        const block = createImageBlock('https://example.com/a.png', '');
        block.width = 120;
        expect(exportHtml(imageDocument(block))).toContain('width="120"');
    });

    it('wraps the image in a link and applies border radius', () => {
        const block = createImageBlock('https://example.com/a.png', '');
        block.href = 'https://example.com/?a=1&b=2';
        block.styles.borderRadius = 8;
        const html = exportHtml(imageDocument(block));
        expect(html).toContain('<a href="https://example.com/?a=1&amp;b=2" target="_blank"');
        expect(html).toContain('border-radius:8px;');
    });

    it('skips images without a source', () => {
        const html = exportHtml(imageDocument(createImageBlock()));
        expect(html).not.toContain('<img');
    });
});

describe('exportHtml() content background', () => {
    it('paints the content area with its own colour, separate from the email background', () => {
        const doc = createEmptyDocument();
        doc.styles.backgroundColor = '#111111';
        doc.styles.contentBackgroundColor = '#eeeeee';
        const html = exportHtml(doc);
        expect(html).toContain('<body style="margin:0;padding:0;background-color:#111111;">');
        expect(html).toContain('bgcolor="#eeeeee"');
        expect(html).toContain('background-color:#eeeeee;font-family:');
    });
});
