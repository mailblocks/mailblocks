import { supportDetails, type Family, type Platform, type SupportLevel } from './compat';
import type { Block, EmailDocument, TextStyles } from './model';

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
    }
}

function checkStyles<Styles>(
    blockId: string,
    styles: Styles,
    checks: readonly StyleCheck<Styles>[],
    targets: readonly Target[],
): CompatWarning[] {
    const warnings: CompatWarning[] = [];
    for (const { property, feature, isSet } of checks) {
        if (!isSet(styles)) continue;
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
    }
    return warnings;
}
