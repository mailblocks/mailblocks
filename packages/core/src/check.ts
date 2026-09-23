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
}

// Content width is not checked: the exporter sets it as an HTML width
// attribute as well, which is what Outlook relies on.
const DOCUMENT_STYLE_CHECKS: StyleCheck<DocumentStyles>[] = [
    // One check covers both the email and the content background.
    { property: 'backgroundColor', feature: 'css-background-color', isSet: () => true },
    { property: 'fontFamily', feature: 'css-font', isSet: () => true },
];

const ROW_STYLE_CHECKS: StyleCheck<RowStyles>[] = [
    {
        property: 'backgroundColor',
        feature: 'css-background-color',
        isSet: (s) => s.backgroundColor !== undefined,
    },
    {
        property: 'padding',
        feature: 'css-padding',
        isSet: (s) => s.paddingTop + s.paddingBottom > 0,
    },
];

const TEXT_STYLE_CHECKS: StyleCheck<TextStyles>[] = [
    { property: 'fontFamily', feature: 'css-font', isSet: (s) => s.fontFamily !== undefined },
    { property: 'fontSize', feature: 'css-font-size', isSet: () => true },
    { property: 'lineHeight', feature: 'css-line-height', isSet: () => true },
    { property: 'textAlign', feature: 'css-text-align', isSet: (s) => s.textAlign !== 'left' },
    {
        property: 'padding',
        feature: 'css-padding',
        isSet: (s) => s.paddingTop + s.paddingRight + s.paddingBottom + s.paddingLeft > 0,
    },
];

const IMAGE_STYLE_CHECKS: StyleCheck<ImageStyles>[] = [
    { property: 'borderRadius', feature: 'css-border-radius', isSet: (s) => s.borderRadius > 0 },
    {
        property: 'padding',
        feature: 'css-padding',
        isSet: (s) => s.paddingTop + s.paddingRight + s.paddingBottom + s.paddingLeft > 0,
    },
];

const BUTTON_STYLE_CHECKS: StyleCheck<ButtonStyles>[] = [
    { property: 'backgroundColor', feature: 'css-background-color', isSet: () => true },
    { property: 'fontFamily', feature: 'css-font', isSet: (s) => s.fontFamily !== undefined },
    { property: 'fontSize', feature: 'css-font-size', isSet: () => true },
    { property: 'bold', feature: 'css-font-weight', isSet: (s) => s.bold },
    { property: 'borderRadius', feature: 'css-border-radius', isSet: (s) => s.borderRadius > 0 },
    // The button's own padding is always there, so padding is always in use.
    { property: 'padding', feature: 'css-padding', isSet: () => true },
];

const DIVIDER_STYLE_CHECKS: StyleCheck<DividerStyles>[] = [
    { property: 'thickness', feature: 'css-border', isSet: (s) => s.thickness > 0 },
    {
        property: 'padding',
        feature: 'css-padding',
        isSet: (s) => s.paddingTop + s.paddingRight + s.paddingBottom + s.paddingLeft > 0,
    },
];

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
        .flatMap(({ property, feature }) => checkFeature(subject, property, feature, targets));
}

/** Warnings for one Can I Email feature across the targets. */
function checkFeature(
    subject: WarningSubject,
    property: string,
    feature: string,
    targets: readonly Target[],
): CompatWarning[] {
    const warnings: CompatWarning[] = [];
    for (const target of targets) {
        const details = supportDetails(feature, target.family, target.platform);
        if (!details || details.level === 'y') continue;
        warnings.push({
            subject,
            property,
            feature,
            target,
            level: details.level,
            version: details.version,
            notes: details.notes,
        });
    }
    return warnings;
}
