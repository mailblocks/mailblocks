import { describe, expect, it } from 'vitest';
import { exportHtml } from './export';
import {
    createButtonBlock,
    createDividerBlock,
    createEmptyDocument,
    createImageBlock,
    createRow,
    createSpacerBlock,
    createTextBlock,
    type Block,
    type EmailDocument,
} from './model';

function documentWith(...blocks: Block[]): EmailDocument {
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
            '<td bgcolor="#ffffff" style="padding:20px 0 30px 0;background-color:#ffffff;">',
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

describe('exportHtml() with button blocks', () => {
    function buttonHtml(block: ReturnType<typeof createButtonBlock>) {
        const doc = createEmptyDocument();
        const row = createRow();
        row.columns[0]?.blocks.push(block);
        doc.rows.push(row);
        return exportHtml(doc);
    }

    it('puts the colour and padding on a table cell and the label in a link', () => {
        const html = buttonHtml(createButtonBlock('Buy & save', 'https://example.com/?a=1&b=2'));

        expect(html).toContain(
            '<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">',
        );
        expect(html).toContain(
            '<td align="center" bgcolor="#2563eb" style="background-color:#2563eb;border-radius:4px;padding:12px 24px;">',
        );
        expect(html).toContain(
            '<a href="https://example.com/?a=1&amp;b=2" target="_blank" style="',
        );
        expect(html).toContain('font-weight:bold;');
        expect(html).toContain('color:#ffffff;text-decoration:none;');
        expect(html).toContain('>Buy &amp; save</a>');
    });

    it('leaves out the link target, border radius and bold when not set', () => {
        const block = createButtonBlock('Go');
        block.styles.borderRadius = 0;
        block.styles.bold = false;
        const html = buttonHtml(block);

        expect(html).toContain('<a style="display:inline-block;');
        expect(html).not.toContain('border-radius');
        expect(html).toContain('font-weight:normal;');
    });

    it('skips buttons without a label', () => {
        expect(buttonHtml(createButtonBlock(''))).not.toContain('<a');
    });
});

describe('exportHtml() with divider and spacer blocks', () => {
    function blockHtml(block: Parameters<typeof documentWith>[0]) {
        return exportHtml(documentWith(block));
    }

    it('draws a divider as the top border of a table', () => {
        const block = createDividerBlock();
        block.styles.color = '#ff0000';
        block.styles.thickness = 2;
        block.styles.lineStyle = 'dashed';
        block.styles.width = 50;
        block.styles.align = 'left';
        const html = blockHtml(block);

        expect(html).toContain(
            '<table role="presentation" align="left" width="50%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;width:50%;border-top:2px dashed #ff0000;">',
        );
        expect(html).toContain(
            '<td style="height:0;font-size:0;line-height:0;mso-line-height-rule:exactly;">&nbsp;</td>',
        );
    });

    it('keeps the divider width between 1 and 100 percent', () => {
        const block = createDividerBlock();
        block.styles.width = 250;
        expect(blockHtml(block)).toContain('width="100%"');
    });

    it('renders a spacer as a cell with matching height, font size and line height', () => {
        expect(blockHtml(createSpacerBlock(30))).toContain(
            '<td height="30" style="height:30px;font-size:30px;line-height:30px;mso-line-height-rule:exactly;">&nbsp;</td>',
        );
    });

    it('never renders a spacer below one pixel', () => {
        expect(blockHtml(createSpacerBlock(0))).toContain('<td height="1"');
    });
});

describe('exportHtml() background fallbacks', () => {
    it('sets bgcolor on the outer table and on coloured rows only', () => {
        const doc = createEmptyDocument();
        doc.styles.backgroundColor = '#abcdef';
        const plain = createRow();
        const coloured = createRow();
        coloured.styles.backgroundColor = '#123456';
        doc.rows.push(plain, coloured);
        const html = exportHtml(doc);

        expect(html).toContain(
            '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#abcdef" style="background-color:#abcdef;">',
        );
        expect(html).toContain(
            '<td bgcolor="#123456" style="padding:0px 0 0px 0;background-color:#123456;">',
        );
        expect(html).toContain('<td style="padding:0px 0 0px 0;">');
    });
});

describe('exportHtml() VML fallback for rounded buttons', () => {
    function buttonHtml(configure: (block: ReturnType<typeof createButtonBlock>) => void) {
        const block = createButtonBlock('Shop now', 'https://example.com/?a=1&b=2');
        configure(block);
        return exportHtml(documentWith(block));
    }

    it('draws a rounded button as a VML roundrect for Outlook and hides the HTML one from it', () => {
        const html = buttonHtml(() => {});
        const start = html.indexOf('<!--[if mso]>\n<v:roundrect');
        const vml = html.slice(start, html.indexOf('<![endif]-->', start));
        expect(start).toBeGreaterThan(0);

        expect(vml).toContain('<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml"');
        expect(vml).toContain('href="https://example.com/?a=1&amp;b=2"');
        expect(vml).toContain('fillcolor="#2563eb"');
        expect(vml).toContain('stroke="f"');
        expect(vml).toContain('<w:anchorlock/>');
        expect(vml).toContain('>Shop now</center>');
        // 16px text: 19px line height + 2 × 12px padding
        expect(vml).toContain('height:43px;');
        // 4px radius over half of the 43px height
        expect(vml).toContain('arcsize="19%"');

        expect(html).toMatch(/<!--\[if !mso\]><!-->\n<table role="presentation" align="center"/);
        expect(html).toContain('</table>\n<!--<![endif]-->');
    });

    it('sizes the VML button to fit the label and its padding', () => {
        const widthOf = (text: string) => {
            const html = buttonHtml((block) => (block.text = text));
            return Number(/width:(\d+)px;" arcsize/.exec(html)?.[1]);
        };
        // At least the horizontal padding plus about half an em per character.
        expect(widthOf('Go')).toBeGreaterThanOrEqual(48 + 2 * 8);
        expect(widthOf('Shop the summer sale')).toBeGreaterThan(widthOf('Shop now'));
        expect(widthOf('Shop the summer sale')).toBeGreaterThanOrEqual(48 + 20 * 8);
    });

    it('makes a fully round button with a large radius', () => {
        expect(buttonHtml((block) => (block.styles.borderRadius = 999))).toContain(
            'arcsize="100%"',
        );
    });

    it('leaves square buttons as plain HTML', () => {
        const html = buttonHtml((block) => (block.styles.borderRadius = 0));
        expect(html).not.toContain('v:roundrect');
        expect(html).not.toContain('[if mso]><!--');
        expect(html).not.toContain('<!--[if !mso]>');
    });

    it('omits the VML link when the button has none', () => {
        const html = buttonHtml((block) => (block.href = ''));
        const vml = html.slice(html.indexOf('<v:roundrect'), html.indexOf('</v:roundrect>'));
        expect(vml).not.toContain('href=');
    });
});
