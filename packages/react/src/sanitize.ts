/**
 * Keeps text blocks to the HTML the editor makes and email clients render the
 * same way: paragraphs, line breaks, bold, italic, underline and links. What
 * is pasted or dropped into a text block, and what the browser adds while
 * editing, is brought back to that.
 */

/** Elements dropped along with everything inside them. */
const DROPPED = new Set([
    'SCRIPT',
    'STYLE',
    'TEMPLATE',
    'NOSCRIPT',
    'HEAD',
    'TITLE',
    'META',
    'LINK',
    'IFRAME',
    'FRAME',
    'OBJECT',
    'EMBED',
    'IMG',
    'PICTURE',
    'SVG',
    'MATH',
    'VIDEO',
    'AUDIO',
    'CANVAS',
    'INPUT',
    'BUTTON',
    'SELECT',
    'TEXTAREA',
]);

/** Elements that start a paragraph of their own when pasted. */
const BLOCKS = new Set([
    'P',
    'DIV',
    'H1',
    'H2',
    'H3',
    'H4',
    'H5',
    'H6',
    'LI',
    'BLOCKQUOTE',
    'PRE',
    'TR',
    'DT',
    'DD',
    'SECTION',
    'ARTICLE',
    'HEADER',
    'FOOTER',
    'ASIDE',
    'MAIN',
    'NAV',
    'FIGCAPTION',
    'ADDRESS',
]);

const HEADINGS = /^H[1-6]$/;

/** Elements a text block keeps, with no attributes but a link's `href`. */
const KEPT = new Set(['P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'A']);

/** Template tags of sending services, filled in when the email is sent. */
const MERGE_TAG = /\{\{|\{%|\*\||%%|\[\[/;

/** Whether a link address can work in an email: web, email, phone, or a merge tag. */
export function isSafeHref(href: string): boolean {
    const value = href.trim();
    return /^(https?:\/\/[^/\s]|mailto:.|tel:.)/i.test(value) || MERGE_TAG.test(value);
}

const escapeText = (value: string) =>
    value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

const escapeAttribute = (value: string) => escapeText(value).replaceAll('"', '&quot;');

/** Whether an element's own style makes its text bold or italic, or undoes that. */
function styleOf(element: Element): { bold?: boolean; italic?: boolean } {
    const style = element.getAttribute('style') ?? '';
    const weight = /font-weight\s*:\s*([\w-]+)/i.exec(style)?.[1]?.toLowerCase();
    const fontStyle = /font-style\s*:\s*([\w-]+)/i.exec(style)?.[1]?.toLowerCase();
    return {
        bold:
            weight === undefined
                ? undefined
                : weight === 'bold' || weight === 'bolder' || Number(weight) >= 600,
        italic:
            fontStyle === undefined ? undefined : fontStyle === 'italic' || fontStyle === 'oblique',
    };
}

interface Context {
    bold: boolean;
    italic: boolean;
    underline: boolean;
    link: boolean;
}

/**
 * The HTML of a paste, cut down to what a text block keeps. Block elements
 * become paragraphs (headings in bold, list items with a bullet or number),
 * bold and italic set with CSS become tags, unsafe links lose their link, and
 * everything else, from styles and classes to images and tables, is dropped
 * with only its text kept. A paste of a single paragraph comes back without
 * the paragraph, so it goes into the line the caret is on; a piece of a line,
 * with no block elements at all, keeps the spaces at its ends.
 */
export function cleanPastedHtml(html: string): string {
    const body = new DOMParser().parseFromString(html, 'text/html').body;
    const paragraphs: string[] = [];
    let current = '';
    let sawBlock = false;
    // The last paragraph before its ends were trimmed.
    let untrimmed = '';

    const flush = () => {
        untrimmed = current
            .replace(/<(strong|em|u)><\/\1>/g, '')
            // Spaces either side of something dropped, such as an image.
            .replace(/ {2,}/g, ' ');
        const paragraph = untrimmed.replace(/^(?:\s|<br>)+|(?:\s|<br>)+$/g, '');
        if (paragraph) paragraphs.push(paragraph);
        current = '';
    };

    const walk = (node: Node, context: Context) => {
        for (const child of node.childNodes) {
            if (child.nodeType === Node.TEXT_NODE) {
                current += escapeText((child.textContent ?? '').replace(/[ \t\n\r\f]+/g, ' '));
                continue;
            }
            if (!(child instanceof Element)) continue;
            const tag = child.tagName.toUpperCase();
            if (DROPPED.has(tag)) continue;
            if (tag === 'BR') {
                current += '<br>';
                continue;
            }
            if (BLOCKS.has(tag)) {
                sawBlock = true;
                flush();
                if (tag === 'LI') current += listMarker(child);
                const heading = HEADINGS.test(tag) && !context.bold;
                if (heading) current += '<strong>';
                walk(child, heading ? { ...context, bold: true } : context);
                if (heading) current += '</strong>';
                flush();
                continue;
            }
            // Inline: keep what the element means, not how it is written.
            const style = styleOf(child);
            const bold = style.bold ?? (tag === 'B' || tag === 'STRONG');
            const italic = style.italic ?? (tag === 'I' || tag === 'EM');
            const href = tag === 'A' ? child.getAttribute('href') : null;
            const wrap: [string, string][] = [];
            const next = { ...context };
            if (href && !context.link && isSafeHref(href)) {
                wrap.push([`<a href="${escapeAttribute(href.trim())}">`, '</a>']);
                next.link = true;
            }
            if (bold && !context.bold) {
                wrap.push(['<strong>', '</strong>']);
                next.bold = true;
            }
            if (italic && !context.italic) {
                wrap.push(['<em>', '</em>']);
                next.italic = true;
            }
            if (tag === 'U' && !context.underline) {
                wrap.push(['<u>', '</u>']);
                next.underline = true;
            }
            current += wrap.map(([open]) => open).join('');
            walk(child, next);
            current += wrap
                .map(([, close]) => close)
                .reverse()
                .join('');
        }
    };

    walk(body, { bold: false, italic: false, underline: false, link: false });
    flush();
    if (paragraphs.length === 1 && !sawBlock) {
        // A piece of a line: its end spaces separate it from the words around the caret.
        const edge = (whitespace: string) => (/\s/.test(whitespace) ? ' ' : '');
        return untrimmed.replace(/^(?:\s|<br>)+/, edge).replace(/(?:\s|<br>)+$/, edge);
    }
    if (paragraphs.length === 1) return paragraphs[0]!;
    return paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join('');
}

/** "• " for an item of a bulleted list, "3. " for the third of a numbered one. */
function listMarker(item: Element): string {
    const list = item.parentElement;
    if (list?.tagName.toUpperCase() !== 'OL') return '• ';
    const items = Array.from(list.children).filter((child) => child.tagName.toUpperCase() === 'LI');
    const start = Number(list.getAttribute('start') ?? 1) || 1;
    return `${start + items.indexOf(item)}. `;
}

/**
 * Plain text as a text block's HTML: blank lines separate paragraphs, single
 * line breaks stay line breaks. One paragraph comes back without the `<p>`.
 */
export function plainTextToHtml(text: string): string {
    // A piece of a line keeps the spaces at its ends.
    if (!/[\r\n]/.test(text)) return escapeText(text);
    const paragraphs = text
        .replace(/\r\n?/g, '\n')
        .split(/\n[ \t]*\n+/)
        .map((paragraph) => escapeText(paragraph.trim()).replaceAll('\n', '<br>'))
        .filter(Boolean);
    if (paragraphs.length === 1) return paragraphs[0]!;
    return paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join('');
}

/**
 * Cleans a contentEditable element in place, after the browser changed it:
 * drops what a text block never holds, unwraps the elements it does not keep
 * (such as the `<span style>` Chrome adds when two paragraphs are joined),
 * turns top-level `<div>`s into paragraphs, and removes every attribute but a
 * safe link's `href`. The caret stays where it was. Returns whether anything
 * changed.
 */
export function tidyEditable(root: HTMLElement): boolean {
    const elements = Array.from(root.querySelectorAll('*'));
    const needsWork = elements.some(
        (element) =>
            !KEPT.has(element.tagName.toUpperCase()) ||
            Array.from(element.attributes).some(
                (attribute) =>
                    !(
                        attribute.name === 'href' &&
                        element.tagName.toUpperCase() === 'A' &&
                        isSafeHref(attribute.value)
                    ),
            ),
    );
    if (!needsWork) return false;

    const selection = document.getSelection();
    const saved =
        selection && selection.rangeCount > 0 && root.contains(selection.anchorNode)
            ? {
                  anchor: selection.anchorNode!,
                  anchorOffset: selection.anchorOffset,
                  focus: selection.focusNode!,
                  focusOffset: selection.focusOffset,
              }
            : undefined;

    // Innermost first, so unwrapping never leaves an element to look at twice.
    for (const element of elements.reverse()) {
        const tag = element.tagName.toUpperCase();
        if (DROPPED.has(tag)) {
            element.remove();
            continue;
        }
        if (tag === 'DIV' && element.parentElement === root) {
            const paragraph = document.createElement('p');
            paragraph.append(...element.childNodes);
            element.replaceWith(paragraph);
            continue;
        }
        if (!KEPT.has(tag) || (tag === 'A' && !isSafeHref(element.getAttribute('href') ?? ''))) {
            element.replaceWith(...element.childNodes);
            continue;
        }
        for (const attribute of Array.from(element.attributes)) {
            if (!(tag === 'A' && attribute.name === 'href'))
                element.removeAttribute(attribute.name);
        }
    }

    if (saved && root.contains(saved.anchor) && root.contains(saved.focus)) {
        try {
            selection!.setBaseAndExtent(
                saved.anchor,
                saved.anchorOffset,
                saved.focus,
                saved.focusOffset,
            );
        } catch {
            // An offset past the end of a node that changed: leave the caret where it went.
        }
    }
    return true;
}
