import {
    checkBlock,
    updateBlock,
    updateBlockStyles,
    type Block,
    type BlockLocation,
    type Row,
    type ButtonBlock,
    type DividerBlock,
    type EmailDocument,
    type ImageBlock,
    type SpacerBlock,
    type Target,
    type TextBlock,
    type TextStyles,
} from '@mailblocks/core';
import { DocumentSettings } from './DocumentSettings';
import {
    ALIGN_CHOICES,
    ChoiceField,
    DarkModeFields,
    fieldKey,
    LINE_STYLE_CHOICES,
    numeric,
    PaddingFields,
} from './fields';
import { RowSettings } from './RowSettings';
import { Warnings } from './Warnings';

interface InspectorProps {
    doc: EmailDocument;
    /** `mergeKey` groups consecutive edits of the same field into one undo step. */
    onChange: (doc: EmailDocument, mergeKey?: string) => void;
    selectedBlock: BlockLocation | undefined;
    selectedRow: { row: Row; index: number } | undefined;
    targets: Target[];
}

/**
 * The side panel: the selected block's styles and compatibility warnings,
 * the selected row's settings, or the email's settings when nothing is selected.
 */
export function Inspector({ doc, onChange, selectedBlock, selectedRow, targets }: InspectorProps) {
    if (selectedRow) {
        return (
            <div className="mb-inspector">
                <RowSettings
                    doc={doc}
                    row={selectedRow.row}
                    index={selectedRow.index}
                    onChange={onChange}
                    targets={targets}
                />
            </div>
        );
    }
    if (!selectedBlock) {
        return (
            <div className="mb-inspector">
                <DocumentSettings doc={doc} onChange={onChange} targets={targets} />
            </div>
        );
    }

    const { block } = selectedBlock;

    return (
        <div className="mb-inspector">
            {block.type === 'text' && <TextFields doc={doc} block={block} onChange={onChange} />}
            {block.type === 'image' && <ImageFields doc={doc} block={block} onChange={onChange} />}
            {block.type === 'button' && (
                <ButtonFields doc={doc} block={block} onChange={onChange} />
            )}
            {block.type === 'divider' && (
                <DividerFields doc={doc} block={block} onChange={onChange} />
            )}
            {block.type === 'spacer' && (
                <SpacerFields doc={doc} block={block} onChange={onChange} />
            )}
            <Warnings warnings={checkBlock(block, targets)} />
        </div>
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
            <ChoiceField
                label="Align"
                value={s.textAlign}
                choices={ALIGN_CHOICES}
                onChange={(textAlign) => set({ textAlign })}
            />
            <PaddingFields styles={s} onChange={set} />
            <DarkModeFields
                colors={[
                    {
                        label: 'Dark color',
                        value: s.darkColor,
                        light: s.color,
                        onChange: (darkColor) => set({ darkColor }),
                    },
                ]}
            />
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
            <ChoiceField
                label="Align"
                value={s.align}
                choices={ALIGN_CHOICES}
                onChange={(align) => set({ align })}
            />
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

function ButtonFields({ doc, block, onChange }: FieldsProps<ButtonBlock>) {
    const s = block.styles;
    const set = (patch: Partial<ButtonBlock['styles']>) =>
        onChange(updateBlockStyles(doc, block.id, patch), fieldKey(block.id, patch));
    const setField = (patch: Partial<Pick<ButtonBlock, 'text' | 'href'>>) =>
        onChange(
            updateBlock(doc, block.id, (b) => ({ ...(b as ButtonBlock), ...patch })),
            fieldKey(block.id, patch),
        );

    return (
        <>
            <h3>Button</h3>
            <label>
                Label
                <input
                    type="text"
                    value={block.text}
                    onChange={(event) => setField({ text: event.target.value })}
                />
            </label>
            <label>
                Link
                <input
                    type="url"
                    value={block.href}
                    placeholder="https://"
                    onChange={(event) => setField({ href: event.target.value })}
                />
            </label>
            <ChoiceField
                label="Align"
                value={s.align}
                choices={ALIGN_CHOICES}
                onChange={(align) => set({ align })}
            />
            <label>
                Background
                <input
                    type="color"
                    value={s.backgroundColor}
                    onChange={(event) => set({ backgroundColor: event.target.value })}
                />
            </label>
            <label>
                Text color
                <input
                    type="color"
                    value={s.color}
                    onChange={(event) => set({ color: event.target.value })}
                />
            </label>
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
                Bold
                <input
                    type="checkbox"
                    checked={s.bold}
                    onChange={(event) => set({ bold: event.target.checked })}
                />
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
            <fieldset>
                <legend>Button padding</legend>
                <label>
                    Vertical
                    <input
                        type="number"
                        min={0}
                        value={s.innerPaddingY}
                        onChange={numeric((innerPaddingY) => set({ innerPaddingY }))}
                    />
                </label>
                <label>
                    Horizontal
                    <input
                        type="number"
                        min={0}
                        value={s.innerPaddingX}
                        onChange={numeric((innerPaddingX) => set({ innerPaddingX }))}
                    />
                </label>
            </fieldset>
            <PaddingFields styles={s} onChange={set} legend="Outer padding" />
            <DarkModeFields
                colors={[
                    {
                        label: 'Dark background',
                        value: s.darkBackgroundColor,
                        light: s.backgroundColor,
                        onChange: (darkBackgroundColor) => set({ darkBackgroundColor }),
                    },
                    {
                        label: 'Dark text color',
                        value: s.darkColor,
                        light: s.color,
                        onChange: (darkColor) => set({ darkColor }),
                    },
                ]}
            />
        </>
    );
}

function DividerFields({ doc, block, onChange }: FieldsProps<DividerBlock>) {
    const s = block.styles;
    const set = (patch: Partial<DividerBlock['styles']>) =>
        onChange(updateBlockStyles(doc, block.id, patch), fieldKey(block.id, patch));

    return (
        <>
            <h3>Divider</h3>
            <label>
                Color
                <input
                    type="color"
                    value={s.color}
                    onChange={(event) => set({ color: event.target.value })}
                />
            </label>
            <label>
                Thickness
                <input
                    type="number"
                    min={1}
                    value={s.thickness}
                    onChange={numeric((thickness) => set({ thickness }))}
                />
            </label>
            <ChoiceField
                label="Line style"
                value={s.lineStyle}
                choices={LINE_STYLE_CHOICES}
                onChange={(lineStyle) => set({ lineStyle })}
            />
            <label>
                Width (%)
                <input
                    type="number"
                    min={1}
                    max={100}
                    value={s.width}
                    onChange={numeric((width) => set({ width }))}
                />
            </label>
            <ChoiceField
                label="Align"
                value={s.align}
                choices={ALIGN_CHOICES}
                onChange={(align) => set({ align })}
            />
            <PaddingFields styles={s} onChange={set} />
            <DarkModeFields
                colors={[
                    {
                        label: 'Dark color',
                        value: s.darkColor,
                        light: s.color,
                        onChange: (darkColor) => set({ darkColor }),
                    },
                ]}
            />
        </>
    );
}

function SpacerFields({ doc, block, onChange }: FieldsProps<SpacerBlock>) {
    const set = (patch: Partial<SpacerBlock['styles']>) =>
        onChange(updateBlockStyles(doc, block.id, patch), fieldKey(block.id, patch));

    return (
        <>
            <h3>Spacer</h3>
            <label>
                Height
                <input
                    type="number"
                    min={1}
                    value={block.styles.height}
                    onChange={numeric((height) => set({ height }))}
                />
            </label>
        </>
    );
}
