import type { ButtonBlock } from '@mailblocks/core';

interface ButtonBlockViewProps {
    block: ButtonBlock;
    selected: boolean;
    onSelect: () => void;
}

/** A button block. The label and link are edited in the inspector; the button is not clickable here. */
export function ButtonBlockView({ block, selected, onSelect }: ButtonBlockViewProps) {
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
            <span
                className="mb-button"
                style={{
                    backgroundColor: s.backgroundColor,
                    color: s.color,
                    fontFamily: s.fontFamily,
                    fontSize: s.fontSize,
                    fontWeight: s.bold ? 'bold' : 'normal',
                    lineHeight: `${Math.round(s.fontSize * 1.2)}px`,
                    borderRadius: s.borderRadius,
                    padding: `${s.innerPaddingY}px ${s.innerPaddingX}px`,
                }}
            >
                {block.text || 'Button'}
            </span>
        </div>
    );
}
