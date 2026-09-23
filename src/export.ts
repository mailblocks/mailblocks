import type { Block, Column, EmailDocument, Row, TextBlock } from './model';

/**
 * Renders a document as a complete HTML email.
 *
 * The output is what email clients can actually render: nested tables for
 * layout, inline styles on every cell, pixel units, and a few Outlook-only
 * hints in conditional comments. Nothing here depends on the DOM, so it runs
 * in the browser and on the server alike.
 */
export function exportHtml(doc: EmailDocument): string {
    const { backgroundColor, contentWidth, fontFamily } = doc.styles;
    const rows = doc.rows.map((row) => renderRow(row, doc)).join('\n');

    return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta name="x-apple-disable-message-reformatting" />
<title></title>
<!--[if mso]>
<xml>
<o:OfficeDocumentSettings>
<o:AllowPNG/>
<o:PixelsPerInch>96</o:PixelsPerInch>
</o:OfficeDocumentSettings>
</xml>
<![endif]-->
<style type="text/css">
body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
table { border-collapse: collapse; mso-table-lspace: 0; mso-table-rspace: 0; }
img { border: 0; line-height: 100%; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
p { margin: 0; }
</style>
</head>
<body style="margin:0;padding:0;background-color:${attr(backgroundColor)};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${attr(backgroundColor)};">
<tr>
<td align="center" style="padding:0;">
<table role="presentation" width="${contentWidth}" cellpadding="0" cellspacing="0" border="0" style="width:${contentWidth}px;max-width:${contentWidth}px;font-family:${attr(fontFamily)};">
${rows}
</table>
</td>
</tr>
</table>
</body>
</html>
`;
}

function renderRow(row: Row, doc: EmailDocument): string {
    const { backgroundColor, paddingTop, paddingBottom } = row.styles;
    const styles = [
        `padding:${px(paddingTop)} 0 ${px(paddingBottom)} 0`,
        backgroundColor !== undefined && `background-color:${attr(backgroundColor)}`,
    ];
    const columns = row.columns.map((column) => renderColumn(column, doc)).join('\n');

    return `<tr>
<td style="${css(styles)}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
${columns}
</tr>
</table>
</td>
</tr>`;
}

function renderColumn(column: Column, doc: EmailDocument): string {
    const width = formatPercent(column.width);
    const blocks = column.blocks.map((block) => renderBlock(block, doc)).join('\n');

    return `<td valign="top" width="${width}%" style="width:${width}%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${blocks}
</table>
</td>`;
}

function renderBlock(block: Block, doc: EmailDocument): string {
    switch (block.type) {
        case 'text':
            return renderTextBlock(block, doc);
    }
}

function renderTextBlock(block: TextBlock, doc: EmailDocument): string {
    const s = block.styles;
    const styles = [
        `padding:${px(s.paddingTop)} ${px(s.paddingRight)} ${px(s.paddingBottom)} ${px(s.paddingLeft)}`,
        `font-family:${attr(s.fontFamily ?? doc.styles.fontFamily)}`,
        `font-size:${px(s.fontSize)}`,
        // Outlook on Windows mishandles unitless line-height, so always emit pixels.
        `line-height:${px(Math.round(s.fontSize * s.lineHeight))}`,
        `color:${attr(s.color)}`,
        `text-align:${s.textAlign}`,
    ];

    return `<tr>
<td align="${s.textAlign}" style="${css(styles)}">
${block.html}
</td>
</tr>`;
}

function css(declarations: (string | false | undefined)[]): string {
    return declarations.filter(Boolean).join(';') + ';';
}

function px(value: number): string {
    return `${value}px`;
}

/** Percentages with up to two decimals, without trailing zeros (33.33, 50, 100). */
function formatPercent(value: number): string {
    return String(Math.round(value * 100) / 100);
}

/** Escapes a value for use inside a double-quoted HTML attribute. */
function attr(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('"', '&quot;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
}
