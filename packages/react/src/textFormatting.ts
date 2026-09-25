import { useEffect, useRef, useState } from 'react';

/*
 * Formatting goes through document.execCommand. It is deprecated, but it is
 * still the only built-in way to format contentEditable text in every browser
 * while keeping the browser's own undo for typing; the alternative is an
 * editor library, and this package has no dependencies.
 */

function selectionInside(editor: HTMLElement): boolean {
    const selection = document.getSelection();
    return !!selection && selection.rangeCount > 0 && editor.contains(selection.anchorNode);
}

/** The link the selection is in, if it is inside one within `editor`. */
function linkAtSelection(editor: HTMLElement): HTMLAnchorElement | null {
    const node = document.getSelection()?.anchorNode ?? null;
    const element = node instanceof Element ? node : (node?.parentElement ?? null);
    const link = element?.closest('a') ?? null;
    return link && editor.contains(link) ? link : null;
}

function commandState(command: string): boolean {
    try {
        return document.queryCommandState(command);
    } catch {
        return false;
    }
}

function select(range: Range) {
    const selection = document.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
}

function selectContents(node: Node) {
    const range = document.createRange();
    range.selectNodeContents(node);
    select(range);
}

const escapeHtml = (value: string) =>
    value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');

export interface TextFormatting {
    /** Whether the selection is bold, italic, or in a link. */
    bold: boolean;
    italic: boolean;
    link: boolean;
    run: (command: 'bold' | 'italic') => void;
    /**
     * Remembers the selection, which the link field is about to take the focus
     * from, and returns the address of the link it is in, or ''.
     */
    beginLink: () => string;
    /** Links the remembered selection, or inserts `text` as a link when nothing was selected. */
    applyLink: (href: string, text: string) => void;
    removeLink: () => void;
    /** Gives the remembered selection back to the text. */
    cancelLink: () => void;
}

/**
 * Bold, italic and links for a contentEditable element. `onEdit` runs after
 * each change to its HTML, and `onLinkShortcut` on Ctrl+K inside it. Does
 * nothing while `editor` is null.
 */
export function useTextFormatting(
    editor: HTMLElement | null,
    onEdit: () => void,
    onLinkShortcut: () => void,
): TextFormatting {
    const [state, setState] = useState({ bold: false, italic: false, link: false });
    const saved = useRef<Range | null>(null);

    const refresh = () => {
        if (!editor || !selectionInside(editor)) return;
        setState({
            bold: commandState('bold'),
            italic: commandState('italic'),
            link: linkAtSelection(editor) !== null,
        });
    };

    /** Puts the saved selection back, or the caret at the end of the text. */
    const restoreSelection = (editor: HTMLElement) => {
        editor.focus();
        if (saved.current) {
            select(saved.current);
        } else if (!selectionInside(editor)) {
            const range = document.createRange();
            range.selectNodeContents(editor);
            range.collapse(false);
            select(range);
        }
    };

    const latest = useRef({ refresh, onLinkShortcut });
    latest.current = { refresh, onLinkShortcut };
    useEffect(() => {
        if (!editor) return;
        const onSelectionChange = () => latest.current.refresh();
        const onKeyDown = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                latest.current.onLinkShortcut();
            }
        };
        latest.current.refresh();
        document.addEventListener('selectionchange', onSelectionChange);
        editor.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('selectionchange', onSelectionChange);
            editor.removeEventListener('keydown', onKeyDown);
        };
    }, [editor]);

    return {
        ...state,
        run: (command) => {
            if (!editor) return;
            if (!selectionInside(editor)) restoreSelection(editor);
            document.execCommand(command);
            onEdit();
            refresh();
        },
        beginLink: () => {
            if (!editor) return '';
            const selection = document.getSelection();
            saved.current = selectionInside(editor) ? selection!.getRangeAt(0).cloneRange() : null;
            return linkAtSelection(editor)?.getAttribute('href') ?? '';
        },
        applyLink: (href, text) => {
            if (!editor) return;
            restoreSelection(editor);
            const existing = linkAtSelection(editor);
            if (existing) selectContents(existing);
            if (document.getSelection()?.isCollapsed) {
                document.execCommand(
                    'insertHTML',
                    false,
                    `<a href="${escapeHtml(href)}">${escapeHtml(text)}</a>`,
                );
            } else {
                document.execCommand('createLink', false, href);
            }
            saved.current = null;
            onEdit();
            refresh();
        },
        removeLink: () => {
            if (!editor) return;
            restoreSelection(editor);
            const existing = linkAtSelection(editor);
            if (existing) {
                selectContents(existing);
                document.execCommand('unlink');
                onEdit();
            }
            saved.current = null;
            refresh();
        },
        cancelLink: () => {
            if (!editor) return;
            restoreSelection(editor);
            saved.current = null;
        },
    };
}
