import { describe, expect, it } from 'vitest';
import { exportHtml } from './export';
import { createEmptyDocument, createRow, createTextBlock, type EmailDocument } from './model';

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
