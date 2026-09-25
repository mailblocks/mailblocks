import {
    addBlock,
    addRow,
    check,
    createButtonBlock,
    createDividerBlock,
    createImageBlock,
    createRow,
    createSpacerBlock,
    createTextBlock,
    updateBlock,
    type Block,
    type CompatWarning,
    type EmailDocument,
    type Target,
    type WarningSubject,
} from '@mailblocks/core';
import { useMemo } from 'react';
import { BlockToolbar } from './BlockToolbar';
import { ButtonBlockView } from './ButtonBlockView';
import { withScheme, type ColorScheme } from './colors';
import { CompatMarker } from './CompatMarker';
import { DividerBlockView } from './DividerBlockView';
import { ImageBlockView } from './ImageBlockView';
import type { Selection } from './selection';
import { SpacerBlockView } from './SpacerBlockView';
import { TextBlockView } from './TextBlockView';

/** Block types offered by the "Add block" menu, in menu order. */
const BLOCK_TYPES: { type: Block['type']; label: string; create: () => Block }[] = [
    { type: 'text', label: 'Text', create: () => createTextBlock('<p>New text</p>') },
    { type: 'image', label: 'Image', create: () => createImageBlock() },
    { type: 'button', label: 'Button', create: () => createButtonBlock() },
    { type: 'divider', label: 'Divider', create: () => createDividerBlock() },
    { type: 'spacer', label: 'Spacer', create: () => createSpacerBlock() },
];

const BLOCK_LABELS = Object.fromEntries(
    BLOCK_TYPES.map((option) => [option.type, option.label]),
) as Record<Block['type'], string>;

/** Width of the phone preview, a common phone screen in CSS pixels. */
export const MOBILE_PREVIEW_WIDTH = 375;

interface CanvasProps {
    doc: EmailDocument;
    /** Shows the email as a phone would, with stacking rows stacked. */
    preview: 'desktop' | 'mobile';
    /** Shows the email with its dark mode colours, where it has them. */
    scheme: ColorScheme;
    /** `mergeKey` groups consecutive edits of the same thing into one undo step. */
    onChange: (doc: EmailDocument, mergeKey?: string) => void;
    selection: Selection | undefined;
    onSelect: (selection: Selection | undefined) => void;
    /** Clients whose warnings are marked on the canvas. */
    targets: readonly Target[];
    /** Called when a marker is clicked: show that subject and its warnings. */
    onShowWarnings: (selection: Selection | undefined) => void;
}

const subjectKey = (subject: WarningSubject) =>
    subject.type === 'document' ? 'document' : `${subject.type}:${subject.id}`;

/** Warnings grouped by what they are about, looked up with {@link subjectKey}. */
function warningsBySubject(warnings: readonly CompatWarning[]): Map<string, CompatWarning[]> {
    const groups = new Map<string, CompatWarning[]>();
    for (const warning of warnings) {
        const key = subjectKey(warning.subject);
        groups.set(key, [...(groups.get(key) ?? []), warning]);
    }
    return groups;
}

const NO_WARNINGS: CompatWarning[] = [];

/** Renders the document roughly as the export will, with every block editable in place. */
export function Canvas({
    doc,
    preview,
    scheme,
    onChange,
    selection,
    onSelect,
    targets,
    onShowWarnings,
}: CanvasProps) {
    const { backgroundColor, contentWidth, contentBackgroundColor, fontFamily } = withScheme(
        doc.styles,
        scheme,
    );
    const mobile = preview === 'mobile' && contentWidth > MOBILE_PREVIEW_WIDTH;
    // Same rule as the export: several columns, and not opted out.
    const stacked = (row: EmailDocument['rows'][number]) =>
        mobile && row.columns.length > 1 && row.styles.stackOnMobile !== false;

    const add = (columnId: string, block: Block) => {
        onChange(addBlock(doc, columnId, block));
        onSelect({ type: 'block', id: block.id });
    };

    const addNewRow = (columnCount: number) => {
        const row = createRow(columnCount);
        onChange(addRow(doc, row));
        onSelect({ type: 'row', id: row.id });
    };

    const isSelected = (type: Selection['type'], id: string) =>
        selection?.type === type && selection.id === id;

    const warnings = useMemo(() => warningsBySubject(check(doc, targets)), [doc, targets]);
    const warningsFor = (subject: WarningSubject) =>
        warnings.get(subjectKey(subject)) ?? NO_WARNINGS;

    return (
        <div
            className="mb-canvas"
            // Focusable, so clicking a block that is not text keeps the keyboard shortcuts working.
            tabIndex={-1}
            style={{ backgroundColor }}
            onClick={() => onSelect(undefined)}
        >
            <div
                className="mb-content"
                style={{
                    width: mobile ? MOBILE_PREVIEW_WIDTH : contentWidth,
                    backgroundColor: contentBackgroundColor,
                    fontFamily,
                }}
            >
                <CompatMarker
                    className="mb-marker-document"
                    subject="Email settings"
                    warnings={warningsFor({ type: 'document' })}
                    onClick={() => onShowWarnings(undefined)}
                />
                {doc.rows.map((row, rowIndex) => (
                    <div
                        key={row.id}
                        className={[
                            'mb-row',
                            isSelected('row', row.id) && 'mb-row-selected',
                            stacked(row) && 'mb-row-stacked',
                        ]
                            .filter(Boolean)
                            .join(' ')}
                        data-row-id={row.id}
                        onClick={(event) => {
                            event.stopPropagation();
                            onSelect({ type: 'row', id: row.id });
                        }}
                        style={{
                            backgroundColor: withScheme(row.styles, scheme).backgroundColor,
                            paddingTop: row.styles.paddingTop,
                            paddingBottom: row.styles.paddingBottom,
                        }}
                    >
                        <CompatMarker
                            className="mb-marker-row"
                            subject={`Row ${rowIndex + 1}`}
                            warnings={warningsFor({ type: 'row', id: row.id })}
                            onClick={() => onShowWarnings({ type: 'row', id: row.id })}
                        />
                        {row.columns.map((column) => (
                            <div
                                key={column.id}
                                className="mb-column"
                                style={{ width: stacked(row) ? '100%' : `${column.width}%` }}
                            >
                                {column.blocks.map((block) => (
                                    // The marker sits beside the block view, not in it: a text
                                    // block's element holds only the text being edited.
                                    <div key={block.id} className="mb-block-slot">
                                        {isSelected('block', block.id) && (
                                            <BlockToolbar
                                                doc={doc}
                                                block={block}
                                                onChange={onChange}
                                                onSelect={onSelect}
                                            />
                                        )}
                                        <BlockView
                                            block={block}
                                            scheme={scheme}
                                            selected={isSelected('block', block.id)}
                                            onSelect={() =>
                                                onSelect({ type: 'block', id: block.id })
                                            }
                                            onChange={(next) =>
                                                onChange(
                                                    updateBlock(doc, block.id, () => next),
                                                    `content:${block.id}`,
                                                )
                                            }
                                        />
                                        <CompatMarker
                                            subject={`${BLOCK_LABELS[block.type]} block`}
                                            warnings={warningsFor({ type: 'block', id: block.id })}
                                            onClick={() =>
                                                onShowWarnings({ type: 'block', id: block.id })
                                            }
                                        />
                                    </div>
                                ))}
                                <div className="mb-add-block">
                                    <select
                                        className="mb-add"
                                        aria-label="Add block"
                                        value=""
                                        // Keep the click from selecting the row behind the menu.
                                        onClick={(event) => event.stopPropagation()}
                                        onChange={(event) => {
                                            const chosen = BLOCK_TYPES.find(
                                                (option) => option.type === event.target.value,
                                            );
                                            if (chosen) add(column.id, chosen.create());
                                        }}
                                    >
                                        <option value="" disabled>
                                            + Add block
                                        </option>
                                        {BLOCK_TYPES.map((option) => (
                                            <option key={option.type} value={option.type}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        ))}
                    </div>
                ))}
                <div className="mb-add-row">
                    <button
                        type="button"
                        className="mb-add"
                        onClick={(event) => {
                            event.stopPropagation();
                            addNewRow(1);
                        }}
                    >
                        + Row
                    </button>
                    <button
                        type="button"
                        className="mb-add"
                        onClick={(event) => {
                            event.stopPropagation();
                            addNewRow(2);
                        }}
                    >
                        + 2-column row
                    </button>
                </div>
            </div>
        </div>
    );
}

interface BlockViewProps {
    block: Block;
    scheme: ColorScheme;
    selected: boolean;
    onSelect: () => void;
    onChange: (block: Block) => void;
}

function BlockView({ block, scheme, selected, onSelect, onChange }: BlockViewProps) {
    switch (block.type) {
        case 'text':
            return (
                <TextBlockView
                    block={block}
                    scheme={scheme}
                    selected={selected}
                    onSelect={onSelect}
                    onChange={onChange}
                />
            );
        case 'image':
            return <ImageBlockView block={block} selected={selected} onSelect={onSelect} />;
        case 'button':
            return (
                <ButtonBlockView
                    block={block}
                    scheme={scheme}
                    selected={selected}
                    onSelect={onSelect}
                />
            );
        case 'divider':
            return (
                <DividerBlockView
                    block={block}
                    scheme={scheme}
                    selected={selected}
                    onSelect={onSelect}
                />
            );
        case 'spacer':
            return <SpacerBlockView block={block} selected={selected} onSelect={onSelect} />;
    }
}
