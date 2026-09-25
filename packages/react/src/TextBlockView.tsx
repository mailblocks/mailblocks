import type { TextBlock } from '@mailblocks/core';
import { useEffect, useState } from 'react';
import { withScheme, type ColorScheme } from './colors';

interface TextBlockViewProps {
    block: TextBlock;
    selected: boolean;
    onSelect: () => void;
    onChange: (block: TextBlock) => void;
    scheme?: ColorScheme;
}

/** A text block edited in place with `contentEditable`. */
export function TextBlockView({
    block,
    selected,
    onSelect,
    onChange,
    scheme = 'light',
}: TextBlockViewProps) {
    const [element, setElement] = useState<HTMLDivElement | null>(null);

    // React never re-renders the inner HTML (the element has no children), so
    // typing does not move the caret. Only push the document's HTML into the
    // element when it differs, i.e. after an external change such as undo.
    useEffect(() => {
        if (element && element.innerHTML !== block.html) element.innerHTML = block.html;
    }, [element, block.html]);

    const s = withScheme(block.styles, scheme);
    const emit = () => {
        if (element) onChange({ ...block, html: element.innerHTML });
    };

    return (
        <>
            <div
                ref={setElement}
                className={selected ? 'mb-block mb-block-selected' : 'mb-block'}
                data-block-id={block.id}
                contentEditable
                suppressContentEditableWarning
                style={{
                    fontFamily: s.fontFamily,
                    fontSize: s.fontSize,
                    lineHeight: `${Math.round(s.fontSize * s.lineHeight)}px`,
                    color: s.color,
                    textAlign: s.textAlign,
                    padding: `${s.paddingTop}px ${s.paddingRight}px ${s.paddingBottom}px ${s.paddingLeft}px`,
                }}
                onClick={(event) => {
                    event.stopPropagation();
                    onSelect();
                }}
                onFocus={onSelect}
                onInput={emit}
            />
        </>
    );
}
