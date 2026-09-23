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
import { DividerBlockView } from './DividerBlockView';
import { ImageBlockView } from './ImageBlockView';
import type { Selection } from './selection';
import { SpacerBlockView } from './SpacerBlockView';
import { TextBlockView } from './TextBlockView';

interface CanvasProps {
    doc: EmailDocument;
    /** `mergeKey` groups consecutive edits of the same thing into one undo step. */
    onChange: (doc: EmailDocument, mergeKey?: string) => void;
    selection: Selection | undefined;
    onSelect: (selection: Selection | undefined) => void;
}

/** Renders the document roughly as the export will, with every block editable in place. */
export function Canvas({ doc, onChange, selection, onSelect }: CanvasProps) {
    const { backgroundColor, contentWidth, contentBackgroundColor, fontFamily } = doc.styles;

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
                style={{ width: contentWidth, backgroundColor: contentBackgroundColor, fontFamily }}
            >
                {doc.rows.map((row) => (
                    <div
                        key={row.id}
                        className={isSelected('row', row.id) ? 'mb-row mb-row-selected' : 'mb-row'}
                        data-row-id={row.id}
                        onClick={(event) => {
                            event.stopPropagation();
                            onSelect({ type: 'row', id: row.id });
                        }}
                        style={{
                            backgroundColor: row.styles.backgroundColor,
                            paddingTop: row.styles.paddingTop,
                            paddingBottom: row.styles.paddingBottom,
                        }}
                    >
                        {row.columns.map((column) => (
                            <div
                                key={column.id}
                                className="mb-column"
                                style={{ width: `${column.width}%` }}
                            >
                                {column.blocks.map((block) => (
                                    <BlockView
                                        key={block.id}
                                        block={block}
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
                                    <button
                                        type="button"
                                        className="mb-add"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            add(column.id, createTextBlock('<p>New text</p>'));
                                        }}
                                    >
                                        + Text
                                    </button>
                                    <button
                                        type="button"
                                        className="mb-add"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            add(column.id, createImageBlock());
                                        }}
                                    >
                                        + Image
                                    </button>
                                    <button
                                        type="button"
                                        className="mb-add"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            add(column.id, createButtonBlock());
                                        }}
                                    >
                                        + Button
                                    </button>
                                    <button
                                        type="button"
                                        className="mb-add"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            add(column.id, createDividerBlock());
                                        }}
                                    >
                                        + Divider
                                    </button>
                                    <button
                                        type="button"
                                        className="mb-add"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            add(column.id, createSpacerBlock());
                                        }}
                                    >
                                        + Spacer
                                    </button>
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
    selected: boolean;
    onSelect: () => void;
    onChange: (block: Block) => void;
}

function BlockView({ block, selected, onSelect, onChange }: BlockViewProps) {
    switch (block.type) {
        case 'text':
            return (
                <TextBlockView
                    block={block}
                    selected={selected}
                    onSelect={onSelect}
                    onChange={onChange}
                />
            );
        case 'image':
            return <ImageBlockView block={block} selected={selected} onSelect={onSelect} />;
        case 'button':
            return <ButtonBlockView block={block} selected={selected} onSelect={onSelect} />;
        case 'divider':
            return <DividerBlockView block={block} selected={selected} onSelect={onSelect} />;
        case 'spacer':
            return <SpacerBlockView block={block} selected={selected} onSelect={onSelect} />;
    }
}
