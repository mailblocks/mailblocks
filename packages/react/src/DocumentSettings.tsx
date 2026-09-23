import {
    checkDocument,
    updateDocumentStyles,
    type DocumentStyles,
    type EmailDocument,
    type Target,
} from '@mailblocks/core';
import { fieldKey, numeric } from './fields';
import { Warnings } from './Warnings';

/** Font stacks that render the same, or close to it, in every email client. */
const SAFE_FONTS = [
    'Arial, Helvetica, sans-serif',
    'Helvetica, Arial, sans-serif',
    'Verdana, Geneva, sans-serif',
    'Tahoma, Geneva, sans-serif',
    "'Trebuchet MS', Helvetica, sans-serif",
    'Georgia, serif',
    "'Times New Roman', Times, serif",
    "'Courier New', Courier, monospace",
];

interface DocumentSettingsProps {
    doc: EmailDocument;
    onChange: (doc: EmailDocument, mergeKey?: string) => void;
    targets: Target[];
}

/** Settings of the whole email, shown when nothing is selected. */
export function DocumentSettings({ doc, onChange, targets }: DocumentSettingsProps) {
    const s = doc.styles;
    const set = (patch: Partial<DocumentStyles>) =>
        onChange(updateDocumentStyles(doc, patch), fieldKey('document', patch));
    const fonts = SAFE_FONTS.includes(s.fontFamily) ? SAFE_FONTS : [s.fontFamily, ...SAFE_FONTS];

    return (
        <>
            <h3>Email</h3>
            <label>
                Background
                <input
                    type="color"
                    value={s.backgroundColor}
                    onChange={(event) => set({ backgroundColor: event.target.value })}
                />
            </label>
            <label>
                Content background
                <input
                    type="color"
                    value={s.contentBackgroundColor}
                    onChange={(event) => set({ contentBackgroundColor: event.target.value })}
                />
            </label>
            <label>
                Content width
                <input
                    type="number"
                    min={320}
                    max={900}
                    value={s.contentWidth}
                    onChange={numeric((contentWidth) => set({ contentWidth }))}
                />
            </label>
            <label>
                Font
                <select
                    value={s.fontFamily}
                    onChange={(event) => set({ fontFamily: event.target.value })}
                >
                    {fonts.map((font) => (
                        <option key={font} value={font}>
                            {font.split(',')[0]?.replaceAll("'", '')}
                        </option>
                    ))}
                </select>
            </label>
            <p className="mb-muted">Click a row or a block to edit it.</p>
            <Warnings warnings={checkDocument(doc, targets)} />
        </>
    );
}
