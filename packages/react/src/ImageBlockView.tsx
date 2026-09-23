import type { ImageBlock } from '@mailblocks/core';

interface ImageBlockViewProps {
    block: ImageBlock;
    selected: boolean;
    onSelect: () => void;
}

/** An image block. Its fields are edited in the inspector, not in place. */
export function ImageBlockView({ block, selected, onSelect }: ImageBlockViewProps) {
    const s = block.styles;

    return (
        <div
            className={selected ? 'mb-block mb-block-selected' : 'mb-block'}
            data-block-id={block.id}
            style={{
                textAlign: s.align,
                padding: `${s.paddingTop}px ${s.paddingRight}px ${s.paddingBottom}px ${s.paddingLeft}px`,
            }}
            onClick={(event) => {
                event.stopPropagation();
                onSelect();
            }}
        >
            {block.src ? (
                <img
                    src={block.src}
                    alt={block.alt}
                    style={{
                        display: 'inline-block',
                        width: block.width ?? '100%',
                        maxWidth: '100%',
                        height: 'auto',
                        borderRadius: s.borderRadius,
                        verticalAlign: 'top',
                    }}
                />
            ) : (
                <div className="mb-image-placeholder">Set an image URL in the inspector</div>
            )}
        </div>
    );
}
