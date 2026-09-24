import { targetName, type CompatWarning } from '@mailblocks/core';

/** Readable names for the parts of the editor's data that show up in the UI. */

export const LEVEL_LABEL: Record<CompatWarning['level'], string> = {
    n: 'not supported',
    a: 'partial',
    u: 'unknown',
};

const PROPERTY_LABELS: Record<string, string> = {
    backgroundColor: 'Background color',
    bold: 'Bold',
    borderRadius: 'Rounded corners',
    darkBackgroundColor: 'Dark background',
    darkColor: 'Dark color',
    darkContentBackgroundColor: 'Dark content background',
    fontFamily: 'Font',
    fontSize: 'Font size',
    lineHeight: 'Line height',
    padding: 'Padding',
    src: 'Image format',
    textAlign: 'Alignment',
    thickness: 'Line',
};

/** The name of a style a warning is about, e.g. "Font size" for `fontSize`. */
export function propertyLabel(property: string): string {
    return PROPERTY_LABELS[property] ?? property;
}

/** One line per warning, e.g. "Font size: not supported in Outlook Windows". */
export function describeWarning(warning: CompatWarning): string {
    return `${propertyLabel(warning.property)}: ${LEVEL_LABEL[warning.level]} in ${targetName(warning.target)}`;
}

/** What an unsupported style means for the reader of the email, per Can I Email feature. */
const NOT_SUPPORTED: Record<string, string> = {
    'css-at-media-prefers-color-scheme':
        'Your dark colors are not used here: the client shows the light ones, or darkens the email in its own way.',
    'css-background-color': 'The background color does not show here.',
    'css-border': 'The line does not show here.',
    'css-border-radius': 'Corners stay square here.',
    'css-font': 'The font is ignored here; the client uses its own.',
    'css-font-size': 'The font size is ignored here.',
    'css-font-weight': 'Text does not turn bold here.',
    'css-line-height': 'The line height is ignored here.',
    'css-padding': 'The spacing is ignored here.',
    'css-text-align': 'The alignment is ignored here.',
};

/**
 * A plain explanation of a warning, or `undefined` when Can I Email's own
 * notes, shown with it, already explain a partial support.
 */
export function explainWarning(warning: CompatWarning): string | undefined {
    switch (warning.level) {
        case 'n':
            if (warning.feature.startsWith('image-')) {
                return 'The image does not show here. JPG, PNG and GIF work almost everywhere.';
            }
            return (
                NOT_SUPPORTED[warning.feature] ??
                'This client ignores this style, so it will not look as designed.'
            );
        case 'a':
            return warning.notes.length > 0
                ? undefined
                : 'Only partly supported; Can I Email gives no details.';
        case 'u':
            return 'Can I Email has not tested this client for it yet, so it may or may not work.';
    }
}
