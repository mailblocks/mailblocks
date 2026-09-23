import type { SpacerBlock } from '@mailblocks/core';

interface SpacerBlockViewProps {
    block: SpacerBlock;
    selected: boolean;
    onSelect: () => void;
}

/** Empty space. Striped in the editor so it can be seen and clicked; blank in the export. */
export function SpacerBlockView({ block, selected, onSelect }: SpacerBlockViewProps) {
    return (
        <div
            className={selected ? 'mb-block mb-spacer mb-block-selected' : 'mb-block mb-spacer'}
            data-block-id={block.id}
            title={`Spacer, ${block.styles.height}px`}
            style={{ height: Math.max(1, block.styles.height) }}
            onClick={(event) => {
                event.stopPropagation();
                onSelect();
            }}
        />
    );
}
