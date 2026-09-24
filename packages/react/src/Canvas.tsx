import {
    addBlock,
    addRow,
    createButtonBlock,
    createDividerBlock,
    createImageBlock,
    createRow,
    createSpacerBlock,
    createTextBlock,
    updateBlock,
    type Block,
    type EmailDocument,
} from '@mailblocks/core';
import { ButtonBlockView } from './ButtonBlockView';
import { withScheme, type ColorScheme } from './colors';
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
}

/** Renders the document roughly as the export will, with every block editable in place. */
export function Canvas({ doc, preview, scheme, onChange, selection, onSelect }: CanvasProps) {
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

    return (
        <div className="mb-canvas" style={{ backgroundColor }} onClick={() => onSelect(undefined)}>
            <div
                className="mb-content"
                style={{
                    width: mobile ? MOBILE_PREVIEW_WIDTH : contentWidth,
                    backgroundColor: contentBackgroundColor,
                    fontFamily,
                }}
            >
                {doc.rows.map((row) => (
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
                        {row.columns.map((column) => (
                            <div
                                key={column.id}
                                className="mb-column"
                                style={{ width: stacked(row) ? '100%' : `${column.width}%` }}
                            >
                                {column.blocks.map((block) => (
                                    <BlockView
                                        key={block.id}
                                        block={block}
                                        scheme={scheme}
                                        selected={isSelected('block', block.id)}
                                        onSelect={() => onSelect({ type: 'block', id: block.id })}
                                        onChange={(next) =>
                                            onChange(
                                                updateBlock(doc, block.id, () => next),
                                                `content:${block.id}`,
                                            )
                                        }
                                    />
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
