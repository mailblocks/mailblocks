import {
    checkBlock,
    removeBlock,
    updateBlock,
    updateBlockStyles,
    type Block,
    type BlockLocation,
    type CompatWarning,
    type EmailDocument,
    type ImageBlock,
    type Target,
    type TextBlock,
    type TextStyles,
} from '@mailblocks/core';
import type { ChangeEvent } from 'react';

interface InspectorProps {
    doc: EmailDocument;
    /** `mergeKey` groups consecutive edits of the same field into one undo step. */
    onChange: (doc: EmailDocument, mergeKey?: string) => void;
    selected: BlockLocation | undefined;
    targets: Target[];
}

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

    return (
        <aside className="mb-inspector">
            {block.type === 'text' && <TextFields doc={doc} block={block} onChange={onChange} />}
            {block.type === 'image' && <ImageFields doc={doc} block={block} onChange={onChange} />}
            <button
                type="button"
                className="mb-remove"
                onClick={() => onChange(removeBlock(doc, block.id))}
            >
                Remove block
            </button>
            <Warnings warnings={checkBlock(block, targets)} />
        </aside>
    );
}

// ---------------------------------------------------------------------------

interface FieldsProps<B extends Block> {
    doc: EmailDocument;
    block: B;
    onChange: (doc: EmailDocument, mergeKey?: string) => void;
}

function TextFields({ doc, block, onChange }: FieldsProps<TextBlock>) {
    const s = block.styles;
    const set = (patch: Partial<TextStyles>) =>
        onChange(updateBlockStyles(doc, block.id, patch), fieldKey(block.id, patch));

    return (
        <>
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
                <input
                    type="number"
                    min={8}
                    value={s.fontSize}
                    onChange={numeric((fontSize) => set({ fontSize }))}
                />
            </label>
            <label>
                Line height
                <input
                    type="number"
                    min={0.8}
                    step={0.1}
                    value={s.lineHeight}
                    onChange={numeric((lineHeight) => set({ lineHeight }))}
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
            <PaddingFields styles={s} onChange={set} />
        </>
    );
}

function ImageFields({ doc, block, onChange }: FieldsProps<ImageBlock>) {
    const s = block.styles;
    const set = (patch: Partial<ImageBlock['styles']>) =>
        onChange(updateBlockStyles(doc, block.id, patch), fieldKey(block.id, patch));
    const setField = (patch: Partial<Omit<ImageBlock, 'id' | 'type' | 'styles'>>) =>
        onChange(
            updateBlock(doc, block.id, (b) => ({ ...(b as ImageBlock), ...patch })),
            fieldKey(block.id, patch),
        );

    return (
        <>
            <h3>Image</h3>
            <label>
                Image URL
                <input
                    type="url"
                    value={block.src}
                    placeholder="https://"
                    onChange={(event) => setField({ src: event.target.value })}
                />
            </label>
            <label>
                Alt text
                <input
                    type="text"
                    value={block.alt}
                    onChange={(event) => setField({ alt: event.target.value })}
                />
            </label>
            <label>
                Link
                <input
                    type="url"
                    value={block.href ?? ''}
                    placeholder="https://"
                    onChange={(event) => setField({ href: event.target.value || undefined })}
                />
            </label>
            <label>
                Width
                <input
                    type="number"
                    min={1}
                    value={block.width ?? ''}
                    placeholder="auto"
                    onChange={(event) =>
                        setField({
                            width: event.target.value ? Number(event.target.value) : undefined,
                        })
                    }
                />
            </label>
            <label>
                Align
                <select
                    value={s.align}
                    onChange={(event) =>
                        set({ align: event.target.value as ImageBlock['styles']['align'] })
                    }
                >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                </select>
            </label>
            <label>
                Border radius
                <input
                    type="number"
                    min={0}
                    value={s.borderRadius}
                    onChange={numeric((borderRadius) => set({ borderRadius }))}
                />
            </label>
            <PaddingFields styles={s} onChange={set} />
        </>
    );
}

interface Padding {
    paddingTop: number;
    paddingRight: number;
    paddingBottom: number;
    paddingLeft: number;
}

function PaddingFields({
    styles,
    onChange,
}: {
    styles: Padding;
    onChange: (patch: Partial<Padding>) => void;
}) {
    const sides = ['Top', 'Right', 'Bottom', 'Left'] as const;
    return (
        <fieldset>
            <legend>Padding</legend>
            {sides.map((side) => {
                const key = `padding${side}` as const;
                return (
                    <label key={side}>
                        {side}
                        <input
                            type="number"
                            min={0}
                            value={styles[key]}
                            onChange={numeric((value) => onChange({ [key]: value }))}
                        />
                    </label>
                );
            })}
        </fieldset>
    );
}

const LEVEL_LABEL: Record<CompatWarning['level'], string> = {
    n: 'not supported',
    a: 'partial',
    u: 'unknown',
};

function Warnings({ warnings }: { warnings: CompatWarning[] }) {
    return (
        <>
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
        </>
    );
}

/** Merge key for edits of the given fields of a block. */
function fieldKey(blockId: string, patch: object): string {
    return `field:${blockId}:${Object.keys(patch).join(',')}`;
}

function numeric(apply: (value: number) => void) {
    return (event: ChangeEvent<HTMLInputElement>) => apply(Number(event.target.value));
}
