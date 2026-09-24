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
 *
 * The content is fluid up to its width, so it fits narrow screens. Rows with
 * several columns stack on those screens: see {@link renderStackingRow}.
 *
 * Dark colours, when the document has any, go into the style sheet: see
 * {@link DarkMode}.
 */
export function exportHtml(doc: EmailDocument): string {
    const { backgroundColor, contentWidth, contentBackgroundColor, fontFamily } = doc.styles;
    const dark = new DarkMode();
    const page = dark.classFor({ background: doc.styles.darkBackgroundColor });
    const content = dark.classFor({ background: doc.styles.darkContentBackgroundColor });
    const rows = doc.rows.map((row) => renderRow(row, doc, dark)).join('\n');
    // Where media queries work, stacked columns also stretch to the full width.
    const stackingStyles = doc.rows.some(stacks)
        ? `
@media only screen and (max-width: ${contentWidth}px) {
.mb-col { max-width: 100% !important; }
}`
        : '';

    return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta name="x-apple-disable-message-reformatting" />${dark.meta()}
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
p { margin: 0; }${stackingStyles}${dark.styles()}
</style>
</head>
<body${page} style="margin:0;padding:0;background-color:${attr(backgroundColor)};">
<table${page} role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${attr(backgroundColor)}" style="background-color:${attr(backgroundColor)};">
<tr>
<td align="center" style="padding:0;">
<!--[if mso]><table role="presentation" width="${contentWidth}" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table${content} role="presentation" width="100%" align="center" cellpadding="0" cellspacing="0" border="0" bgcolor="${attr(contentBackgroundColor)}" style="width:100%;max-width:${contentWidth}px;margin:0 auto;background-color:${attr(contentBackgroundColor)};font-family:${attr(fontFamily)};">
${rows}
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td>
</tr>
</table>
</body>
</html>
`;
}

/** Whether a row's columns go below each other on narrow screens. */
function stacks(row: Row): boolean {
    return row.columns.length > 1 && row.styles.stackOnMobile !== false;
}

function renderRow(row: Row, doc: EmailDocument, dark: DarkMode): string {
    if (stacks(row)) return renderStackingRow(row, doc, dark);
    const { backgroundColor, paddingTop, paddingBottom } = row.styles;
    const styles = [
        `padding:${px(paddingTop)} 0 ${px(paddingBottom)} 0`,
        backgroundColor !== undefined && `background-color:${attr(backgroundColor)}`,
    ];
    // Before the columns, so the classes are numbered in document order.
    const darkClass = dark.classFor({ background: row.styles.darkBackgroundColor });
    const columns = row.columns.map((column) => renderColumn(column, doc, dark)).join('\n');
    const bgcolor = rowBgcolor(row);

    return `<tr>
<td${darkClass}${bgcolor} style="${css(styles)}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
${columns}
</tr>
</table>
</td>
</tr>`;
}

/**
 * A row whose columns stack on narrow screens, the "hybrid" way:
 *
 * - Each column is an inline-block `div`, 100% wide but no wider than its
 *   desktop width. Side by side on wide screens, they wrap below each other
 *   when the screen is too narrow, with no media query needed, which matters
 *   because many clients drop media queries or the whole `<style>`.
 * - Outlook on Windows ignores inline-block and max-width on divs, so it gets
 *   a real table in conditional comments and keeps the desktop layout.
 * - The cell has a zero font size so the whitespace between the inline-blocks
 *   does not add gaps; each column restores a normal size.
 *
 * Column widths are rounded down to whole pixels so they never add up to more
 * than the content width, which would wrap them on desktop too.
 */
function renderStackingRow(row: Row, doc: EmailDocument, dark: DarkMode): string {
    const { backgroundColor, paddingTop, paddingBottom } = row.styles;
    const styles = [
        `padding:${px(paddingTop)} 0 ${px(paddingBottom)} 0`,
        'text-align:center',
        'font-size:0',
        backgroundColor !== undefined && `background-color:${attr(backgroundColor)}`,
    ];
    const darkClass = dark.classFor({ background: row.styles.darkBackgroundColor });
    const columns = row.columns
        .map((column) => {
            const width = Math.floor((doc.styles.contentWidth * column.width) / 100);
            const blocks = column.blocks
                .map((block) => renderBlock(block, doc, width, dark))
                .join('\n');
            const columnStyles = [
                'display:inline-block',
                'width:100%',
                `max-width:${px(width)}`,
                'vertical-align:top',
                'text-align:left',
                'font-size:16px',
            ];
            return `<!--[if mso]><td valign="top" width="${width}"><![endif]-->
<div class="mb-col" style="${css(columnStyles)}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${blocks}
</table>
</div>
<!--[if mso]></td><![endif]-->`;
        })
        .join('\n');

    return `<tr>
<td${darkClass}${rowBgcolor(row)} style="${css(styles)}">
<!--[if mso]><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><![endif]-->
${columns}
<!--[if mso]></tr></table><![endif]-->
</td>
</tr>`;
}

/** The bgcolor attribute backs up the CSS, which some webmails only honour for colour keywords. */
function rowBgcolor(row: Row): string {
    const { backgroundColor } = row.styles;
    return backgroundColor !== undefined ? ` bgcolor="${attr(backgroundColor)}"` : '';
}

function renderColumn(column: Column, doc: EmailDocument, dark: DarkMode): string {
    const width = formatPercent(column.width);
    // Outlook needs images sized in pixels, so blocks get the column's pixel width.
    const columnWidth = Math.round((doc.styles.contentWidth * column.width) / 100);
    const blocks = column.blocks
        .map((block) => renderBlock(block, doc, columnWidth, dark))
        .join('\n');

    return `<td valign="top" width="${width}%" style="width:${width}%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${blocks}
</table>
</td>`;
}

function renderBlock(
    block: Block,
    doc: EmailDocument,
    columnWidth: number,
    dark: DarkMode,
): string {
    switch (block.type) {
        case 'text':
            return renderTextBlock(block, doc, dark);
        case 'image':
            return renderImageBlock(block, columnWidth);
        case 'button':
            return renderButtonBlock(block, doc, dark);
        case 'divider':
            return renderDividerBlock(block, dark);
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

function renderTextBlock(block: TextBlock, doc: EmailDocument, dark: DarkMode): string {
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

    const darkClass = dark.classFor({ color: s.darkColor });

    return `<tr>
<td${darkClass} align="${s.textAlign}" style="${css(styles)}">
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
function renderButtonBlock(block: ButtonBlock, doc: EmailDocument, dark: DarkMode): string {
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
    // The VML version needs none: only Outlook on Windows reads it, and it has no dark colours.
    const darkButton = dark.classFor({ background: s.darkBackgroundColor });
    const darkLabel = dark.classFor({ color: s.darkColor });

    // border-collapse:separate lets border-radius apply to the cell.
    const html = `<table role="presentation" align="${s.align}" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">
<tr>
<td${darkButton} align="center" bgcolor="${attr(s.backgroundColor)}" style="${css(buttonStyles)}">
<a${darkLabel}${href} style="${css(linkStyles)}">${attr(block.text)}</a>
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
function renderDividerBlock(block: DividerBlock, dark: DarkMode): string {
    const s = block.styles;
    const width = formatPercent(Math.min(100, Math.max(1, s.width)));
    const cellStyles = [
        `padding:${px(s.paddingTop)} ${px(s.paddingRight)} ${px(s.paddingBottom)} ${px(s.paddingLeft)}`,
    ];
    const darkClass = dark.classFor({ border: s.darkColor });
    const lineStyles = [
        // Separate borders so the full thickness is drawn, not half of it.
        'border-collapse:separate',
        `width:${width}%`,
        `border-top:${px(s.thickness)} ${s.lineStyle} ${attr(s.color)}`,
    ];

    return `<tr>
<td align="${s.align}" style="${css(cellStyles)}">
<table${darkClass} role="presentation" align="${s.align}" width="${width}%" cellpadding="0" cellspacing="0" border="0" style="${css(lineStyles)}">
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

/** Dark colours of one element. */
interface DarkColors {
    color?: string | undefined;
    background?: string | undefined;
    /** The top border, the only one the export draws. */
    border?: string | undefined;
}

/**
 * Dark colours, collected while rendering and written into the style sheet.
 *
 * Each element with dark colours gets a class of its own, and the style sheet
 * sets its colours with `!important` so they win over the inline light ones:
 *
 * - `@media (prefers-color-scheme: dark)` for the clients that support it.
 *   Outlook.com is kept out with `:not([class^="x_"])`: it prefixes every
 *   class with `x_`, and its media query follows the browser's theme rather
 *   than Outlook's own, so it could turn the email dark in a light inbox.
 * - `[data-ogsc]` (text) and `[data-ogsb]` (background) for Outlook.com, which
 *   marks the elements whose colours it changed in dark mode with these
 *   attributes (Can I Email, css-at-media-prefers-color-scheme). There is no
 *   such mark for borders.
 * - `color-scheme` meta tags and CSS, which tell the clients that read them
 *   that the email has its own dark colours.
 *
 * Clients without any of these, such as Gmail and Outlook on Windows, never
 * show the dark colours; some of them darken emails on their own.
 */
class DarkMode {
    private readonly rules: (DarkColors & { name: string })[] = [];

    /** A class attribute for an element with these dark colours, or '' when it has none. */
    classFor(colors: DarkColors): string {
        if (!colors.color && !colors.background && !colors.border) return '';
        const name = `mb-dark-${this.rules.length + 1}`;
        this.rules.push({ ...colors, name });
        return ` class="${name}"`;
    }

    meta(): string {
        if (this.rules.length === 0) return '';
        return `
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />`;
    }

    styles(): string {
        if (this.rules.length === 0) return '';
        const media: string[] = [];
        const outlook: string[] = [];
        for (const { name, color, background, border } of this.rules) {
            const declarations = [
                color && `color:${cssValue(color)} !important;`,
                background && `background-color:${cssValue(background)} !important;`,
                border && `border-top-color:${cssValue(border)} !important;`,
            ];
            media.push(`.${name}:not([class^="x_"]) { ${declarations.filter(Boolean).join(' ')} }`);
            if (color) outlook.push(`[data-ogsc] .${name} { ${declarations[0]} }`);
            if (background) outlook.push(`[data-ogsb] .${name} { ${declarations[1]} }`);
        }
        return `
:root { color-scheme: light dark; supported-color-schemes: light dark; }
@media (prefers-color-scheme: dark) {
${media.join('\n')}
}
${outlook.join('\n')}`.trimEnd();
    }
}

/**
 * Keeps a colour from breaking out of its declaration in the style sheet,
 * where HTML escaping does not help: only characters found in hex, named and
 * functional colours are kept.
 */
function cssValue(value: string): string {
    return value.replace(/[^#\w\s(),.%-]/g, '');
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
