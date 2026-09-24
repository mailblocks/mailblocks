import { supportDetails, type Family, type Platform, type SupportLevel } from './compat';
import type {
    Block,
    ButtonStyles,
    DividerStyles,
    DocumentStyles,
    EmailDocument,
    ImageStyles,
    Row,
    RowStyles,
    TextStyles,
} from './model';

/** An email client the document should render well in. */
export interface Target {
    family: Family;
    platform: Platform;
}

/** What a warning is about: the email as a whole, one row, or one block. */
export type WarningSubject =
    { type: 'document' } | { type: 'row'; id: string } | { type: 'block'; id: string };

/** A style used in the document that a target client does not fully support. */
export interface CompatWarning {
    subject: WarningSubject;
    /** The style that triggered the warning, e.g. "fontSize" or "padding". */
    property: string;
    /** The Can I Email feature it depends on, e.g. "css-font-size". */
    feature: string;
    target: Target;
    level: Exclude<SupportLevel, 'y'>;
    /** Client version Can I Email tested last. */
    version: string;
    /** Can I Email's footnotes, usually what exactly is missing. */
    notes: string[];
}

interface StyleCheck<Styles> {
    property: string;
    feature: string;
    /** Whether the style is actually in use, so untouched defaults do not warn. */
    isSet: (styles: Styles) => boolean;
    /** The CSS values the export writes for this style, used to rule notes in or out. */
    values: (styles: Styles) => string[];
    /**
     * A Can I Email note describing a workaround the export already uses for this
     * style. Where a client's result carries that note, the style renders fine
     * and no warning is reported, whatever the support level.
     */
    workaround?: RegExp;
}

interface Padding {
    paddingTop: number;
    paddingRight: number;
    paddingBottom: number;
    paddingLeft: number;
}

const SIDES: (keyof Padding)[] = ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'];

const px = (value: number) => `${value}px`;

function paddingCheck<S extends Padding>(): StyleCheck<S> {
    return {
        property: 'padding',
        feature: 'css-padding',
        isSet: (s) => SIDES.some((side) => s[side] > 0),
        values: (s) => SIDES.map((side) => px(s[side])),
    };
}

/**
 * A dark mode colour. Clients show it only when they support the media query
 * the export puts it in, so that is the feature to check.
 */
function darkCheck<S>(property: keyof S & string): StyleCheck<S> {
    return {
        property,
        feature: 'css-at-media-prefers-color-scheme',
        isSet: (s) => s[property] !== undefined,
        values: (s) => [String(s[property])],
    };
}

// Content width is not checked: the exporter sets it as an HTML width
// attribute as well, which is what Outlook relies on.
const DOCUMENT_STYLE_CHECKS: StyleCheck<DocumentStyles>[] = [
    // One check covers both the email and the content background.
    {
        property: 'backgroundColor',
        feature: 'css-background-color',
        isSet: () => true,
        values: (s) => [s.backgroundColor, s.contentBackgroundColor],
    },
    {
        property: 'fontFamily',
        feature: 'css-font',
        isSet: () => true,
        values: (s) => [s.fontFamily],
    },
    darkCheck('darkBackgroundColor'),
    darkCheck('darkContentBackgroundColor'),
];

const ROW_STYLE_CHECKS: StyleCheck<RowStyles>[] = [
    {
        property: 'backgroundColor',
        feature: 'css-background-color',
        isSet: (s) => s.backgroundColor !== undefined,
        values: (s) => [s.backgroundColor ?? ''],
    },
    {
        property: 'padding',
        feature: 'css-padding',
        isSet: (s) => s.paddingTop + s.paddingBottom > 0,
        values: (s) => [px(s.paddingTop), px(s.paddingBottom)],
    },
    darkCheck('darkBackgroundColor'),
];

const TEXT_STYLE_CHECKS: StyleCheck<TextStyles>[] = [
    {
        property: 'fontFamily',
        feature: 'css-font',
        isSet: (s) => s.fontFamily !== undefined,
        values: (s) => [s.fontFamily ?? ''],
    },
    {
        property: 'fontSize',
        feature: 'css-font-size',
        isSet: () => true,
        values: (s) => [px(s.fontSize)],
    },
    {
        property: 'lineHeight',
        feature: 'css-line-height',
        isSet: () => true,
        values: (s) => [px(Math.round(s.fontSize * s.lineHeight))],
    },
    {
        property: 'textAlign',
        feature: 'css-text-align',
        isSet: (s) => s.textAlign !== 'left',
        values: (s) => [s.textAlign],
    },
    paddingCheck(),
    darkCheck('darkColor'),
];

const IMAGE_STYLE_CHECKS: StyleCheck<ImageStyles>[] = [
    {
        property: 'borderRadius',
        feature: 'css-border-radius',
        isSet: (s) => s.borderRadius > 0,
        values: (s) => [px(s.borderRadius)],
    },
    paddingCheck(),
];

const BUTTON_STYLE_CHECKS: StyleCheck<ButtonStyles>[] = [
    {
        property: 'backgroundColor',
        feature: 'css-background-color',
        isSet: () => true,
        values: (s) => [s.backgroundColor],
    },
    {
        property: 'fontFamily',
        feature: 'css-font',
        isSet: (s) => s.fontFamily !== undefined,
        values: (s) => [s.fontFamily ?? ''],
    },
    {
        property: 'fontSize',
        feature: 'css-font-size',
        isSet: () => true,
        values: (s) => [px(s.fontSize)],
    },
    {
        property: 'bold',
        feature: 'css-font-weight',
        isSet: (s) => s.bold,
        values: () => ['bold'],
    },
    {
        property: 'borderRadius',
        feature: 'css-border-radius',
        isSet: (s) => s.borderRadius > 0,
        values: (s) => [px(s.borderRadius)],
        // Rounded buttons are also drawn in VML for the clients this note is attached to.
        workaround: /VML/,
    },
    // The button's own padding is always there, so padding is always in use.
    {
        property: 'padding',
        feature: 'css-padding',
        isSet: () => true,
        values: (s) => [
            px(s.innerPaddingY),
            px(s.innerPaddingX),
            ...SIDES.map((side) => px(s[side])),
        ],
    },
    darkCheck('darkBackgroundColor'),
    darkCheck('darkColor'),
];

const DIVIDER_STYLE_CHECKS: StyleCheck<DividerStyles>[] = [
    {
        property: 'thickness',
        feature: 'css-border',
        isSet: (s) => s.thickness > 0,
        values: (s) => [`${px(s.thickness)} ${s.lineStyle} ${s.color}`],
    },
    paddingCheck(),
    darkCheck('darkColor'),
];

/**
 * When a client only partly supports a feature, Can I Email explains why in
 * notes. Many notes are about values the export never writes, or problems the
 * export already works around. Each rule recognises one note by its text and
 * says whether it applies to the values actually written. Notes without a rule
 * are always kept, so a reworded note in new data shows up again rather than
 * being hidden.
 */
interface NoteRule {
    feature: string;
    note: RegExp;
    /** Omitted when the export always avoids the problem, so the note never applies. */
    appliesTo?: (values: readonly string[]) => boolean;
}

/** The 16 colour keywords of CSS Level 1. */
const CSS1_COLOR_KEYWORDS = new Set([
    'aqua',
    'black',
    'blue',
    'fuchsia',
    'gray',
    'green',
    'lime',
    'maroon',
    'navy',
    'olive',
    'purple',
    'red',
    'silver',
    'teal',
    'white',
    'yellow',
]);

const NOTE_RULES: NoteRule[] = [
    {
        feature: 'css-text-align',
        note: /`start` and `end`/,
        appliesTo: (values) => values.some((v) => v === 'start' || v === 'end'),
    },
    {
        feature: 'css-text-align',
        note: /match-parent/,
        appliesTo: (values) => values.some((v) => v.endsWith('match-parent')),
    },
    {
        feature: 'css-background-color',
        note: /color keywords from CSS Level 1/,
        appliesTo: (values) => values.some((v) => !CSS1_COLOR_KEYWORDS.has(v.trim().toLowerCase())),
    },
    {
        feature: 'css-font-size',
        note: /`rem` values/,
        appliesTo: (values) => values.some((v) => v.endsWith('rem')),
    },
    {
        feature: 'css-font-size',
        note: /`relative` and `percentage`/,
        appliesTo: (values) => values.some((v) => v.endsWith('%') || /^(smaller|larger)$/.test(v)),
    },
    {
        feature: 'css-font-weight',
        note: /`<number>` values/,
        appliesTo: (values) => values.some((v) => /^\d+$/.test(v.trim())),
    },
    // Pixel line heights are always followed by mso-line-height-rule:exactly.
    { feature: 'css-line-height', note: /mso-line-height-rule:exactly/ },
    {
        feature: 'css-line-height',
        note: /`normal` value/,
        appliesTo: (values) => values.includes('normal'),
    },
    // Padding is only ever written on table cells...
    { feature: 'css-padding', note: /Only supported on table cells/ },
    // ...and every padded cell is the only cell in its table row.
    { feature: 'css-padding', note: /same for all cells of a same row/ },
    {
        feature: 'css-border',
        note: /bigger than 8px/,
        appliesTo: (values) => values.some((v) => parseFloat(v) > 8),
    },
    // Borders are drawn on tables, never on <p> or <div>.
    { feature: 'css-border', note: /`<p>` or a `<div>`/ },
    {
        feature: 'css-border-radius',
        note: /slash `\/` notation/,
        appliesTo: (values) => values.some((v) => v.includes('/')),
    },
];

/**
 * The notes of a partial-support result that apply to `values`. `undefined`
 * when there were notes and none of them apply, which means the partial
 * support does not affect this document.
 */
function relevantNotes(
    feature: string,
    notes: string[],
    values: readonly string[],
): string[] | undefined {
    if (notes.length === 0) return notes;
    const kept = notes.filter((note) => {
        const rule = NOTE_RULES.find((r) => r.feature === feature && r.note.test(note));
        return !rule || (rule.appliesTo?.(values) ?? false);
    });
    return kept.length > 0 ? kept : undefined;
}

/** Can I Email feature slug per image file extension. */
const IMAGE_FORMAT_FEATURES: Record<string, string> = {
    jpg: 'image-jpg',
    jpeg: 'image-jpg',
    png: 'image-png',
    gif: 'image-gif',
    webp: 'image-webp',
    svg: 'image-svg',
    avif: 'image-avif',
    bmp: 'image-bmp',
    ico: 'image-ico',
    tif: 'image-tiff',
    tiff: 'image-tiff',
    heif: 'image-heif',
    heic: 'image-heif',
    apng: 'image-apng',
};

/**
 * The Can I Email feature for an image URL's format, judged by its file
 * extension or `data:` prefix. `undefined` when the format cannot be told.
 */
export function imageFormatFeature(src: string): string | undefined {
    if (src.startsWith('data:')) return 'image-base64';
    const path = src.split(/[?#]/)[0] ?? '';
    const extension = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
    return path.includes('.') ? IMAGE_FORMAT_FEATURES[extension] : undefined;
}

/**
 * Lists every style in the document that one of the `targets` does not fully
 * support according to Can I Email: the email settings first, then each row
 * followed by its blocks. An empty array means the document is safe for all
 * targets, as far as Can I Email knows.
 */
export function check(doc: EmailDocument, targets: readonly Target[]): CompatWarning[] {
    const warnings = checkDocument(doc, targets);
    for (const row of doc.rows) {
        warnings.push(...checkRow(row, targets));
        for (const column of row.columns) {
            for (const block of column.blocks) warnings.push(...checkBlock(block, targets));
        }
    }
    return warnings;
}

/** Warnings for the email-wide settings only, not its rows or blocks. */
export function checkDocument(doc: EmailDocument, targets: readonly Target[]): CompatWarning[] {
    return checkStyles({ type: 'document' }, doc.styles, DOCUMENT_STYLE_CHECKS, targets);
}

/** Warnings for a row's own settings, not its blocks. */
export function checkRow(row: Row, targets: readonly Target[]): CompatWarning[] {
    return checkStyles({ type: 'row', id: row.id }, row.styles, ROW_STYLE_CHECKS, targets);
}

/** Same as {@link check} for a single block. */
export function checkBlock(block: Block, targets: readonly Target[]): CompatWarning[] {
    const subject: WarningSubject = { type: 'block', id: block.id };
    switch (block.type) {
        case 'text':
            return checkStyles(subject, block.styles, TEXT_STYLE_CHECKS, targets);
        case 'image': {
            const format = imageFormatFeature(block.src);
            return [
                ...(format ? checkFeature(subject, 'src', format, targets) : []),
                ...checkStyles(subject, block.styles, IMAGE_STYLE_CHECKS, targets),
            ];
        }
        case 'button':
            return checkStyles(subject, block.styles, BUTTON_STYLE_CHECKS, targets);
        case 'divider':
            return checkStyles(subject, block.styles, DIVIDER_STYLE_CHECKS, targets);
        case 'spacer':
            // Rendered with a height attribute and a matching line height, which
            // does not depend on any partially supported CSS.
            return [];
    }
}

function checkStyles<Styles>(
    subject: WarningSubject,
    styles: Styles,
    checks: readonly StyleCheck<Styles>[],
    targets: readonly Target[],
): CompatWarning[] {
    return checks
        .filter(({ isSet }) => isSet(styles))
        .flatMap(({ property, feature, values, workaround }) =>
            checkFeature(subject, property, feature, targets, values(styles), workaround),
        );
}

/** Warnings for one Can I Email feature across the targets. */
function checkFeature(
    subject: WarningSubject,
    property: string,
    feature: string,
    targets: readonly Target[],
    values: readonly string[] = [],
    workaround?: RegExp,
): CompatWarning[] {
    const warnings: CompatWarning[] = [];
    for (const target of targets) {
        const details = supportDetails(feature, target.family, target.platform);
        if (!details || details.level === 'y') continue;
        if (workaround && details.notes.some((note) => workaround.test(note))) continue;
        // Only partial support can be narrowed down by its notes; 'n' and 'u' always stand.
        const notes =
            details.level === 'a' ? relevantNotes(feature, details.notes, values) : details.notes;
        if (!notes) continue;
        warnings.push({
            subject,
            property,
            feature,
            target,
            level: details.level,
            version: details.version,
            notes,
        });
    }
    return warnings;
}
