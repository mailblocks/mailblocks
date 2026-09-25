import type { TextBlock } from '@mailblocks/core';
import { useEffect, useState, type ClipboardEvent, type FormEvent } from 'react';
import { withScheme, type ColorScheme } from './colors';
import { cleanPastedHtml, cleanTextHtml, plainTextToHtml, tidyEditable } from './sanitize';

/** Undoes the escaping of text that cleanPastedHtml and plainTextToHtml did. */
const unescapeText = (html: string) =>
    html.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');

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
    // It is cleaned first: the document may come from a file or a host that
    // holds more than a text block should, such as an <img onerror>.
    useEffect(() => {
        if (element && element.innerHTML !== block.html) {
            element.innerHTML = cleanTextHtml(block.html);
        }
    }, [element, block.html]);

    const s = withScheme(block.styles, scheme);
    const emit = () => {
        if (element) onChange({ ...block, html: element.innerHTML });
    };

    // Whatever the browser put in (a drop, a joined paragraph), bring it back to
    // what a text block holds before saving. Not while an input method is still
    // composing a character, which a change to the DOM would interrupt.
    const onInput = (event: FormEvent<HTMLDivElement>) => {
        if (element && !(event.nativeEvent as InputEvent).isComposing) tidyEditable(element);
        emit();
    };

    // Paste only what a text block keeps: see cleanPastedHtml.
    const onPaste = (event: ClipboardEvent<HTMLDivElement>) => {
        const html = event.clipboardData.getData('text/html');
        const text = event.clipboardData.getData('text/plain');
        const clean = html ? cleanPastedHtml(html) : plainTextToHtml(text);
        event.preventDefault();
        if (!clean) return;
        // Both commands fire the input event that tidies and saves the result.
        if (!clean.includes('<')) {
            // Plain text keeps its spaces exactly with insertText.
            document.execCommand('insertText', false, unescapeText(clean));
        } else {
            // insertHTML splits the paragraph around the caret properly, but drops
            // the spaces at the ends of what it inserts unless they cannot break.
            document.execCommand(
                'insertHTML',
                false,
                clean
                    .replace(/^((?:<[^/>][^>]*>)*) /, '$1&nbsp;')
                    .replace(/ ((?:<\/[^>]+>)*)$/, '&nbsp;$1'),
            );
        }
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
                onInput={onInput}
                onPaste={onPaste}
            />
        </>
    );
}
