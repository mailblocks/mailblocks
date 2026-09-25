import type { WarningSubject } from './check';
import { exportHtml } from './export';
import type { Block, EmailDocument, Row } from './model';

/**
 * Problems no single CSS property explains, so Can I Email has no entry for
 * them: an email Gmail will cut short, links that go nowhere, images without
 * a text alternative, text that is hard to read.
 */
export interface LintIssue {
    subject: WarningSubject;
    rule: LintRule;
    /** `error`: readers will see something broken. `warning`: worth a look. */
    severity: 'error' | 'warning';
    /** What is wrong, in one line. */
    message: string;
    /** Why it matters and what to do about it. */
    hint: string;
}

export type LintRule =
    | 'gmail-clipping'
    | 'link-invalid'
    | 'link-missing'
    | 'image-src'
    | 'image-alt'
    | 'contrast'
    | 'dark-contrast';

/**
 * Gmail shows only the first 102 KB of an email's HTML and hides the rest
 * behind a "[Message clipped] View entire message" link.
 */
export const GMAIL_CLIP_BYTES = 102 * 1024;

/** From this size on, the email is close enough to the clip to say so. */
const GMAIL_CLIP_WARNING_BYTES = 90 * 1024;

/** WCAG AA: 4.5:1 for body text, 3:1 for large text. */
const MIN_CONTRAST = 4.5;
const MIN_CONTRAST_LARGE = 3;

/** Every issue in the document: the email as a whole first, then each block in order. */
export function lint(doc: EmailDocument): LintIssue[] {
    const issues = lintDocument(doc);
    const dark = usesDarkMode(doc);
    for (const row of doc.rows) {
        for (const column of row.columns) {
            for (const block of column.blocks) issues.push(...lintBlock(block, row, doc, dark));
        }
    }
    return issues;
}

function lintDocument(doc: EmailDocument): LintIssue[] {
    const bytes = new TextEncoder().encode(exportHtml(doc)).length;
    const size = `${Math.round(bytes / 1024)} KB`;
    const subject: WarningSubject = { type: 'document' };
    const hint =
        'Gmail hides everything after the first 102 KB behind a "View entire message" link, ' +
        'unsubscribe links included. Shorten the email; your sending service may also add ' +
        'some for tracking.';
    if (bytes > GMAIL_CLIP_BYTES) {
        return [
            {
                subject,
                rule: 'gmail-clipping',
                severity: 'error',
                message: `Gmail will clip this email: it is ${size}, over Gmail's 102 KB.`,
                hint,
            },
        ];
    }
    if (bytes > GMAIL_CLIP_WARNING_BYTES) {
        return [
            {
                subject,
                rule: 'gmail-clipping',
                severity: 'warning',
                message: `The email is ${size}, close to the 102 KB where Gmail clips it.`,
                hint,
            },
        ];
    }
    return [];
}

function lintBlock(block: Block, row: Row, doc: EmailDocument, dark: boolean): LintIssue[] {
    const subject: WarningSubject = { type: 'block', id: block.id };
    const issues: Omit<LintIssue, 'subject'>[] = [];
    const lightBackground = row.styles.backgroundColor ?? doc.styles.contentBackgroundColor;
    // In dark mode a row keeps its light background unless it has a dark one.
    const darkBackground =
        row.styles.darkBackgroundColor ??
        row.styles.backgroundColor ??
        doc.styles.darkContentBackgroundColor ??
        doc.styles.contentBackgroundColor;

    switch (block.type) {
        case 'text': {
            const s = block.styles;
            for (const href of linksIn(block.html))
                issues.push(...checkHref(href, 'A link in this text'));
            const large = s.fontSize >= 24;
            issues.push(...checkContrast(s.color, lightBackground, large, false));
            if (dark)
                issues.push(...checkContrast(s.darkColor ?? s.color, darkBackground, large, true));
            break;
        }
        case 'button': {
            const s = block.styles;
            if (!block.href.trim()) {
                issues.push({
                    rule: 'link-missing',
                    severity: 'warning',
                    message: 'The button does not link anywhere.',
                    hint: 'Give it a link in the toolbar or the inspector.',
                });
            } else {
                issues.push(...checkHref(block.href, "The button's link"));
            }
            const large = s.fontSize >= 24 || (s.bold && s.fontSize >= 18.66);
            issues.push(...checkContrast(s.color, s.backgroundColor, large, false));
            if (dark) {
                issues.push(
                    ...checkContrast(
                        s.darkColor ?? s.color,
                        s.darkBackgroundColor ?? s.backgroundColor,
                        large,
                        true,
                    ),
                );
            }
            break;
        }
        case 'image':
            if (!block.src.trim()) {
                issues.push({
                    rule: 'image-src',
                    severity: 'warning',
                    message: 'The image has no URL, so it is left out of the email.',
                    hint: 'Add the address of the image, starting with https://.',
                });
                break;
            }
            if (!block.alt.trim()) {
                issues.push({
                    rule: 'image-alt',
                    severity: 'warning',
                    message: 'The image has no alt text.',
                    hint:
                        'Alt text shows while images are blocked, which Outlook does by default, ' +
                        'and is what screen readers read out.',
                });
            }
            if (block.href !== undefined) issues.push(...checkHref(block.href, "The image's link"));
            break;
        case 'divider':
        case 'spacer':
            break;
    }
    return issues.map((issue) => ({ subject, ...issue }));
}

/** Whether any colour in the document has a dark counterpart, which is when the export turns dark mode on. */
function usesDarkMode(doc: EmailDocument): boolean {
    const hasDark = (styles: object) =>
        Object.entries(styles).some(
            ([key, value]) => key.startsWith('dark') && value !== undefined,
        );
    return (
        hasDark(doc.styles) ||
        doc.rows.some(
            (row) =>
                hasDark(row.styles) ||
                row.columns.some((column) => column.blocks.some((block) => hasDark(block.styles))),
        )
    );
}

/** The `href` of every link in a block of HTML, decoded. */
function linksIn(html: string): string[] {
    return Array.from(html.matchAll(/<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/gi), (match) =>
        (match[1] ?? match[2] ?? '').replaceAll('&amp;', '&'),
    );
}

/**
 * Template tags of sending services, filled in when the email is sent:
 * {{ … }}, {% … %}, *|…|*, %%…%%, [[ … ]].
 */
const MERGE_TAG = /\{\{|\{%|\*\||%%|\[\[/;

/**
 * Links in an email must be absolute: a relative one has nothing to be
 * relative to in an inbox, and scripts are stripped.
 */
function checkHref(href: string, what: string): Omit<LintIssue, 'subject'>[] {
    const value = href.trim();
    if (MERGE_TAG.test(value) || /^(https?:\/\/[^/\s]|mailto:.|tel:.)/i.test(value)) return [];
    return [
        {
            rule: 'link-invalid',
            severity: 'error',
            message: `${what} will not work: "${value || '(empty)'}".`,
            hint: 'Email links need a full address: https://…, mailto:… or tel:….',
        },
    ];
}

function checkContrast(
    foreground: string,
    background: string,
    large: boolean,
    dark: boolean,
): Omit<LintIssue, 'subject'>[] {
    const ratio = contrastRatio(foreground, background);
    const minimum = large ? MIN_CONTRAST_LARGE : MIN_CONTRAST;
    if (ratio === undefined || ratio >= minimum) return [];
    const shown = `${Math.floor(ratio * 10) / 10}:1`;
    return [
        {
            rule: dark ? 'dark-contrast' : 'contrast',
            severity: 'warning',
            message: dark
                ? `In dark mode the text is hard to read: contrast ${shown}, below ${minimum}:1.`
                : `The text is hard to read: contrast ${shown}, below ${minimum}:1.`,
            hint: dark
                ? 'Give it a dark mode colour that stands out from the dark background.'
                : 'Make the text darker or the background lighter, or the other way round.',
        },
    ];
}

/**
 * The WCAG contrast ratio of two `#rgb` or `#rrggbb` colours, from 1 (the same)
 * to 21 (black on white). `undefined` when either is not a hex colour.
 */
export function contrastRatio(a: string, b: string): number | undefined {
    const la = luminance(a);
    const lb = luminance(b);
    if (la === undefined || lb === undefined) return undefined;
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Relative luminance, as WCAG defines it. */
function luminance(color: string): number | undefined {
    const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
    if (!match) return undefined;
    const hex = match[1]!.length === 3 ? [...match[1]!].map((d) => d + d).join('') : match[1]!;
    const [r, g, b] = [0, 2, 4].map((i) => {
        const channel = parseInt(hex.slice(i, i + 2), 16) / 255;
        return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
