import {
    checkDocument,
    updateDocumentStyles,
    type DocumentStyles,
    type EmailDocument,
    type Target,
} from '@mailblocks/core';
import { ColorField, DarkModeFields, fieldKey, numeric, Section } from './fields';
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
            <Section title="Email">
                <ColorField
                    label="Background"
                    value={s.backgroundColor}
                    onChange={(backgroundColor) => set({ backgroundColor })}
                />
                <ColorField
                    label="Content background"
                    value={s.contentBackgroundColor}
                    onChange={(contentBackgroundColor) => set({ contentBackgroundColor })}
                />
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
            </Section>
            <DarkModeFields
                colors={[
                    {
                        label: 'Dark background',
                        value: s.darkBackgroundColor,
                        light: s.backgroundColor,
                        onChange: (darkBackgroundColor) => set({ darkBackgroundColor }),
                    },
                    {
                        label: 'Dark content background',
                        value: s.darkContentBackgroundColor,
                        light: s.contentBackgroundColor,
                        onChange: (darkContentBackgroundColor) =>
                            set({ darkContentBackgroundColor }),
                    },
                ]}
            />
            <p className="mb-muted">Click a row or a block to edit it.</p>
            <Warnings warnings={checkDocument(doc, targets)} />
        </>
    );
}
