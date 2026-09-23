import {
    checkBlock,
    removeBlock,
    updateBlockStyles,
    type BlockLocation,
    type CompatWarning,
    type EmailDocument,
    type Target,
    type TextStyles,
} from '@mailblocks/core';

interface InspectorProps {
    doc: EmailDocument;
    onChange: (doc: EmailDocument) => void;
    selected: BlockLocation | undefined;
    targets: Target[];
}

const LEVEL_LABEL: Record<CompatWarning['level'], string> = {
    n: 'not supported',
    a: 'partial',
    u: 'unknown',
};

/** Style controls and compatibility warnings for the selected block. */
export function Inspector({ doc, onChange, selected, targets }: InspectorProps) {
    if (!selected) {
        return (
            <aside className="mb-inspector">
                <p className="mb-muted">Select a block to edit it.</p>
            </aside>
        );
    }

    const { block } = selected;
    const s = block.styles;
    const set = (patch: Partial<TextStyles>) => onChange(updateBlockStyles(doc, block.id, patch));
    const number = (key: keyof TextStyles) => (event: React.ChangeEvent<HTMLInputElement>) =>
        set({ [key]: Number(event.target.value) });
    const warnings = checkBlock(block, targets);

    return (
        <aside className="mb-inspector">
            <h3>Text</h3>
            <label>
                Font family
                <input
                    type="text"
                    value={s.fontFamily ?? ''}
                    placeholder={doc.styles.fontFamily}
                    onChange={(event) => set({ fontFamily: event.target.value || undefined })}
                />
            </label>
            <label>
                Font size
                <input type="number" min={8} value={s.fontSize} onChange={number('fontSize')} />
            </label>
            <label>
                Line height
                <input
                    type="number"
                    min={0.8}
                    step={0.1}
                    value={s.lineHeight}
                    onChange={number('lineHeight')}
                />
            </label>
            <label>
                Color
                <input
                    type="color"
                    value={s.color}
                    onChange={(event) => set({ color: event.target.value })}
                />
            </label>
            <label>
                Align
                <select
                    value={s.textAlign}
                    onChange={(event) =>
                        set({ textAlign: event.target.value as TextStyles['textAlign'] })
                    }
                >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                </select>
            </label>
            <fieldset>
                <legend>Padding</legend>
                <label>
                    Top
                    <input
                        type="number"
                        min={0}
                        value={s.paddingTop}
                        onChange={number('paddingTop')}
                    />
                </label>
                <label>
                    Right
                    <input
                        type="number"
                        min={0}
                        value={s.paddingRight}
                        onChange={number('paddingRight')}
                    />
                </label>
                <label>
                    Bottom
                    <input
                        type="number"
                        min={0}
                        value={s.paddingBottom}
                        onChange={number('paddingBottom')}
                    />
                </label>
                <label>
                    Left
                    <input
                        type="number"
                        min={0}
                        value={s.paddingLeft}
                        onChange={number('paddingLeft')}
                    />
                </label>
            </fieldset>
            <button
                type="button"
                className="mb-remove"
                onClick={() => onChange(removeBlock(doc, block.id))}
            >
                Remove block
            </button>

            <h3>
                Warnings <span className="mb-muted">({warnings.length})</span>
            </h3>
            {warnings.length === 0 ? (
                <p className="mb-muted">No warnings for the selected targets.</p>
            ) : (
                <ul className="mb-warnings">
                    {warnings.map((warning) => (
                        <li
                            key={`${warning.property}/${warning.target.family}/${warning.target.platform}`}
                        >
                            <span className={`mb-level mb-level-${warning.level}`}>
                                {LEVEL_LABEL[warning.level]}
                            </span>
                            <strong>{warning.property}</strong> in {warning.target.family}{' '}
                            {warning.target.platform}
                            {warning.notes.length > 0 && (
                                <ul className="mb-notes">
                                    {warning.notes.map((note) => (
                                        <li key={note}>{note}</li>
                                    ))}
                                </ul>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </aside>
    );
}
