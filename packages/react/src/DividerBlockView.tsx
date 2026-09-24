import type { DividerBlock } from '@mailblocks/core';
import { withScheme, type ColorScheme } from './colors';

interface DividerBlockViewProps {
    block: DividerBlock;
    selected: boolean;
    onSelect: () => void;
    scheme?: ColorScheme;
}

/** A horizontal line, edited in the inspector. */
export function DividerBlockView({
    block,
    selected,
    onSelect,
    scheme = 'light',
}: DividerBlockViewProps) {
    const s = withScheme(block.styles, scheme);

    return (
        <div
            className={selected ? 'mb-block mb-block-selected' : 'mb-block'}
            data-block-id={block.id}
            style={{
                padding: `${s.paddingTop}px ${s.paddingRight}px ${s.paddingBottom}px ${s.paddingLeft}px`,
            }}
            onClick={(event) => {
                event.stopPropagation();
                onSelect();
            }}
        >
            <div
                className="mb-divider"
                style={{
                    width: `${Math.min(100, Math.max(1, s.width))}%`,
                    marginLeft: s.align === 'left' ? 0 : 'auto',
                    marginRight: s.align === 'right' ? 0 : 'auto',
                    borderTop: `${s.thickness}px ${s.lineStyle} ${s.color}`,
                }}
            />
        </div>
    );
}
