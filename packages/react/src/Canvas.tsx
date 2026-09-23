import {
    addBlock,
    addRow,
    createImageBlock,
    createRow,
    createTextBlock,
    updateBlock,
    type Block,
    type EmailDocument,
} from '@mailblocks/core';
import { ImageBlockView } from './ImageBlockView';
import { TextBlockView } from './TextBlockView';

interface CanvasProps {
    doc: EmailDocument;
    /** `mergeKey` groups consecutive edits of the same thing into one undo step. */
    onChange: (doc: EmailDocument, mergeKey?: string) => void;
    selectedBlockId: string | undefined;
    onSelect: (blockId: string | undefined) => void;
}

/** Renders the document roughly as the export will, with every block editable in place. */
export function Canvas({ doc, onChange, selectedBlockId, onSelect }: CanvasProps) {
    const { backgroundColor, contentWidth, contentBackgroundColor, fontFamily } = doc.styles;

    const add = (columnId: string, block: Block) => {
        onChange(addBlock(doc, columnId, block));
        onSelect(block.id);
    };

    return (
        <div className="mb-canvas" style={{ backgroundColor }} onClick={() => onSelect(undefined)}>
            <div
                className="mb-content"
                style={{ width: contentWidth, backgroundColor: contentBackgroundColor, fontFamily }}
            >
                {doc.rows.map((row) => (
                    <div
                        key={row.id}
                        className="mb-row"
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
                                        selected={block.id === selectedBlockId}
                                        onSelect={() => onSelect(block.id)}
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
                            onChange(addRow(doc, createRow(1)));
                        }}
                    >
                        + Row
                    </button>
                    <button
                        type="button"
                        className="mb-add"
                        onClick={(event) => {
                            event.stopPropagation();
                            onChange(addRow(doc, createRow(2)));
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
    }
}
