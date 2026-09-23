import { supportDetails, type Family, type Platform, type SupportLevel } from './compat';
import type { Block, EmailDocument, ImageStyles, TextStyles } from './model';

/** An email client the document should render well in. */
export interface Target {
    family: Family;
    platform: Platform;
}

/** A style used by a block that a target client does not fully support. */
export interface CompatWarning {
    blockId: string;
    /** The block style that triggered the warning, e.g. "fontSize" or "padding". */
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
    /** Whether the block actually uses this style, so untouched defaults do not warn. */
    isSet: (styles: Styles) => boolean;
}

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
 * support according to Can I Email. An empty array means the document is safe
 * for all targets, as far as Can I Email knows.
 */
export function check(doc: EmailDocument, targets: readonly Target[]): CompatWarning[] {
    const warnings: CompatWarning[] = [];
    for (const row of doc.rows) {
        for (const column of row.columns) {
            for (const block of column.blocks) warnings.push(...checkBlock(block, targets));
        }
    }
    return warnings;
}

/** Same as {@link check} for a single block. */
export function checkBlock(block: Block, targets: readonly Target[]): CompatWarning[] {
    switch (block.type) {
        case 'text':
            return checkStyles(block.id, block.styles, TEXT_STYLE_CHECKS, targets);
        case 'image': {
            const format = imageFormatFeature(block.src);
            return [
                ...(format ? checkFeature(block.id, 'src', format, targets) : []),
                ...checkStyles(block.id, block.styles, IMAGE_STYLE_CHECKS, targets),
            ];
        }
    }
}

function checkStyles<Styles>(
    blockId: string,
    styles: Styles,
    checks: readonly StyleCheck<Styles>[],
    targets: readonly Target[],
): CompatWarning[] {
    return checks
        .filter(({ isSet }) => isSet(styles))
        .flatMap(({ property, feature }) => checkFeature(blockId, property, feature, targets));
}

/** Warnings for one Can I Email feature across the targets. */
function checkFeature(
    blockId: string,
    property: string,
    feature: string,
    targets: readonly Target[],
): CompatWarning[] {
    const warnings: CompatWarning[] = [];
    for (const target of targets) {
        const details = supportDetails(feature, target.family, target.platform);
        if (!details || details.level === 'y') continue;
        warnings.push({
            blockId,
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
