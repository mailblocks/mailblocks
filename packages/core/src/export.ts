import type {
    Block,
    ButtonBlock,
    Column,
    DividerBlock,
    EmailDocument,
    ImageBlock,
    Row,
    SpacerBlock,
    TextBlock,
} from './model';

/**
 * Renders a document as a complete HTML email.
 *
 * The output is what email clients can actually render: nested tables for
 * layout, inline styles on every cell, pixel units, and a few Outlook-only
 * hints in conditional comments. Nothing here depends on the DOM, so it runs
 * in the browser and on the server alike.
 */
export function exportHtml(doc: EmailDocument): string {
    const { backgroundColor, contentWidth, contentBackgroundColor, fontFamily } = doc.styles;
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
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${attr(backgroundColor)}" style="background-color:${attr(backgroundColor)};">
<tr>
<td align="center" style="padding:0;">
<table role="presentation" width="${contentWidth}" cellpadding="0" cellspacing="0" border="0" bgcolor="${attr(contentBackgroundColor)}" style="width:${contentWidth}px;max-width:${contentWidth}px;background-color:${attr(contentBackgroundColor)};font-family:${attr(fontFamily)};">
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
    // The bgcolor attribute backs up the CSS, which some webmails only honour for colour keywords.
    const bgcolor = backgroundColor !== undefined ? ` bgcolor="${attr(backgroundColor)}"` : '';

    return `<tr>
<td${bgcolor} style="${css(styles)}">
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
    // Outlook needs images sized in pixels, so blocks get the column's pixel width.
    const columnWidth = Math.round((doc.styles.contentWidth * column.width) / 100);
    const blocks = column.blocks.map((block) => renderBlock(block, doc, columnWidth)).join('\n');

    return `<td valign="top" width="${width}%" style="width:${width}%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${blocks}
</table>
</td>`;
}

function renderBlock(block: Block, doc: EmailDocument, columnWidth: number): string {
    switch (block.type) {
        case 'text':
            return renderTextBlock(block, doc);
        case 'image':
            return renderImageBlock(block, columnWidth);
        case 'button':
            return renderButtonBlock(block, doc);
        case 'divider':
            return renderDividerBlock(block);
        case 'spacer':
            return renderSpacerBlock(block);
    }
}

function renderImageBlock(block: ImageBlock, columnWidth: number): string {
    if (!block.src) return '';
    const s = block.styles;
    const available = Math.max(0, columnWidth - s.paddingLeft - s.paddingRight);
    const width = Math.min(block.width ?? available, available);
    const cellStyles = [
        `padding:${px(s.paddingTop)} ${px(s.paddingRight)} ${px(s.paddingBottom)} ${px(s.paddingLeft)}`,
    ];
    const imageStyles = [
        'display:block',
        `width:${px(width)}`,
        'max-width:100%',
        'height:auto',
        'border:0',
        s.borderRadius > 0 && `border-radius:${px(s.borderRadius)}`,
        s.align === 'center' && 'margin:0 auto',
        s.align === 'right' && 'margin:0 0 0 auto',
    ];
    const image = `<img src="${attr(block.src)}" alt="${attr(block.alt)}" width="${width}" style="${css(imageStyles)}" />`;
    const content = block.href
        ? `<a href="${attr(block.href)}" target="_blank" style="display:block;">${image}</a>`
        : image;

    return `<tr>
<td align="${s.align}" style="${css(cellStyles)}">
${content}
</td>
</tr>`;
}

function renderTextBlock(block: TextBlock, doc: EmailDocument): string {
    const s = block.styles;
    const styles = [
        `padding:${px(s.paddingTop)} ${px(s.paddingRight)} ${px(s.paddingBottom)} ${px(s.paddingLeft)}`,
        `font-family:${attr(s.fontFamily ?? doc.styles.fontFamily)}`,
        `font-size:${px(s.fontSize)}`,
        // Outlook on Windows mishandles unitless line-height, so always emit pixels,
        // and tell it to respect them exactly (Can I Email, css-line-height footnote).
        `line-height:${px(Math.round(s.fontSize * s.lineHeight))}`,
        `mso-line-height-rule:exactly`,
        `color:${attr(s.color)}`,
        `text-align:${s.textAlign}`,
    ];

    return `<tr>
<td align="${s.textAlign}" style="${css(styles)}">
${block.html}
</td>
</tr>`;
}

/**
 * A "bulletproof" button: a table cell carries the colour and the padding,
 * because Outlook on Windows only honours padding on table cells, and the link
 * inside it carries the label.
 *
 * Outlook on Windows cannot round table cells, so a rounded button is also
 * drawn as a VML `roundrect` inside a conditional comment only Outlook reads,
 * and the HTML button is hidden from Outlook. VML needs a fixed size, so the
 * width is estimated from the label.
 */
function renderButtonBlock(block: ButtonBlock, doc: EmailDocument): string {
    if (!block.text) return '';
    const s = block.styles;
    const fontFamily = s.fontFamily ?? doc.styles.fontFamily;
    const lineHeight = Math.round(s.fontSize * 1.2);
    const cellStyles = [
        `padding:${px(s.paddingTop)} ${px(s.paddingRight)} ${px(s.paddingBottom)} ${px(s.paddingLeft)}`,
    ];
    const buttonStyles = [
        `background-color:${attr(s.backgroundColor)}`,
        s.borderRadius > 0 && `border-radius:${px(s.borderRadius)}`,
        `padding:${px(s.innerPaddingY)} ${px(s.innerPaddingX)}`,
    ];
    const linkStyles = [
        'display:inline-block',
        `font-family:${attr(fontFamily)}`,
        `font-size:${px(s.fontSize)}`,
        `font-weight:${s.bold ? 'bold' : 'normal'}`,
        `line-height:${px(lineHeight)}`,
        'mso-line-height-rule:exactly',
        `color:${attr(s.color)}`,
        'text-decoration:none',
    ];
    const href = block.href ? ` href="${attr(block.href)}" target="_blank"` : '';

    // border-collapse:separate lets border-radius apply to the cell.
    const html = `<table role="presentation" align="${s.align}" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">
<tr>
<td align="center" bgcolor="${attr(s.backgroundColor)}" style="${css(buttonStyles)}">
<a${href} style="${css(linkStyles)}">${attr(block.text)}</a>
</td>
</tr>
</table>`;

    let content = html;
    if (s.borderRadius > 0) {
        const width =
            Math.ceil(estimateTextWidth(block.text, s.fontSize, s.bold)) + 2 * s.innerPaddingX;
        const height = lineHeight + 2 * s.innerPaddingY;
        // arcsize is a percentage of half the smaller side (100% is fully round).
        const arcsize = Math.min(
            100,
            Math.round((s.borderRadius / (Math.min(width, height) / 2)) * 100),
        );
        const vmlHref = block.href ? ` href="${attr(block.href)}"` : '';
        const labelStyles = [
            `color:${attr(s.color)}`,
            `font-family:${attr(fontFamily)}`,
            `font-size:${px(s.fontSize)}`,
            `font-weight:${s.bold ? 'bold' : 'normal'}`,
        ];
        content = `<!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"${vmlHref} style="height:${px(height)};v-text-anchor:middle;width:${px(width)};" arcsize="${arcsize}%" stroke="f" fillcolor="${attr(s.backgroundColor)}">
<w:anchorlock/>
<center style="${css(labelStyles)}">${attr(block.text)}</center>
</v:roundrect>
<![endif]-->
<!--[if !mso]><!-->
${html}
<!--<![endif]-->`;
    }

    return `<tr>
<td align="${s.align}" style="${css(cellStyles)}">
${content}
</td>
</tr>`;
}

/**
 * Rough rendered width of `text` in pixels, from average glyph widths of common
 * email fonts. Errs on the wide side: a VML button that is slightly too wide
 * only gets more padding, one that is too narrow wraps its label.
 */
function estimateTextWidth(text: string, fontSize: number, bold: boolean): number {
    let ems = 0;
    for (const char of text) {
        if (char === ' ') ems += 0.3;
        else if (/[iljtfrI.,:;'!|()[\]]/.test(char)) ems += 0.35;
        else if (/[mwMW@%]/.test(char)) ems += 0.95;
        else if (/[A-Z]/.test(char)) ems += 0.72;
        else ems += 0.58;
    }
    return ems * fontSize * (bold ? 1.08 : 1);
}

/**
 * The line is the top border of a table: Outlook on Windows draws borders on
 * tables and cells reliably, but not on `<p>` or `<div>`. The empty cell is
 * collapsed to zero height so only the border shows.
 */
function renderDividerBlock(block: DividerBlock): string {
    const s = block.styles;
    const width = formatPercent(Math.min(100, Math.max(1, s.width)));
    const cellStyles = [
        `padding:${px(s.paddingTop)} ${px(s.paddingRight)} ${px(s.paddingBottom)} ${px(s.paddingLeft)}`,
    ];
    const lineStyles = [
        // Separate borders so the full thickness is drawn, not half of it.
        'border-collapse:separate',
        `width:${width}%`,
        `border-top:${px(s.thickness)} ${s.lineStyle} ${attr(s.color)}`,
    ];

    return `<tr>
<td align="${s.align}" style="${css(cellStyles)}">
<table role="presentation" align="${s.align}" width="${width}%" cellpadding="0" cellspacing="0" border="0" style="${css(lineStyles)}">
<tr>
<td style="height:0;font-size:0;line-height:0;mso-line-height-rule:exactly;">&nbsp;</td>
</tr>
</table>
</td>
</tr>`;
}

/**
 * The height goes on the cell as an attribute and as a matching font size and
 * line height: CSS height alone is ignored on some elements in Outlook and
 * turned into min-height by Yahoo.
 */
function renderSpacerBlock(block: SpacerBlock): string {
    const height = Math.max(1, Math.round(block.styles.height));
    const styles = [
        `height:${px(height)}`,
        `font-size:${px(height)}`,
        `line-height:${px(height)}`,
        'mso-line-height-rule:exactly',
    ];
    return `<tr>
<td height="${height}" style="${css(styles)}">&nbsp;</td>
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
