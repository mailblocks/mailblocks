import {
    duplicateBlock,
    findBlock,
    moveBlock,
    removeBlock,
    updateBlock,
    type Block,
    type EmailDocument,
} from '@mailblocks/core';
import { useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { fieldKey } from './fields';
import { AlignIcon, ArrowIcon, DuplicateIcon, LinkIcon, TrashIcon } from './icons';
import { normalizeLink } from './links';
import type { Selection } from './selection';
import { useTextFormatting } from './textFormatting';

type Align = 'left' | 'center' | 'right';

interface BlockToolbarProps {
    doc: EmailDocument;
    block: Block;
    /** `mergeKey` groups consecutive edits of the same thing into one undo step. */
    onChange: (doc: EmailDocument, mergeKey?: string) => void;
    onSelect: (selection: Selection | undefined) => void;
}

/** Keeps a toolbar button from taking the focus, and the text selection with it. */
const keepSelection = (event: MouseEvent) => event.preventDefault();

/**
 * Floats above the selected block: its formats where it has any (bold,
 * italic and links for text; bold and the link for buttons; the link for
 * images), its alignment, and moving, duplicating and removing it.
 *
 * It sits inside the block's slot on the canvas, next to the block's own
 * element, which for text is the contentEditable element it formats.
 */
export function BlockToolbar({ doc, block, onChange, onSelect }: BlockToolbarProps) {
    const ref = useRef<HTMLDivElement>(null);
    const [editor, setEditor] = useState<HTMLElement | null>(null);
    // The link field's text while it is open.
    const [draft, setDraft] = useState<string>();
    const [invalid, setInvalid] = useState(false);
    // Pulls the toolbar back left when it would stick out of the email.
    const [shift, setShift] = useState(0);

    useLayoutEffect(() => {
        const toolbar = ref.current;
        if (!toolbar) return;
        if (block.type === 'text') {
            setEditor(
                toolbar.parentElement?.querySelector<HTMLElement>('[contenteditable]') ?? null,
            );
        }
        const content = toolbar.closest('.mb-content');
        if (!content) return;
        // Where the toolbar would be without the shift, against the email's edges.
        const own = toolbar.getBoundingClientRect();
        const bounds = content.getBoundingClientRect();
        const overflow = own.right + shift - bounds.right;
        const room = own.left + shift - bounds.left;
        const next = Math.max(0, Math.min(Math.ceil(overflow), Math.floor(room)));
        if (next !== shift) setShift(next);
    });

    const location = findBlock(doc, block.id);
    const openLinkField = () => {
        setDraft(block.type === 'text' ? text.beginLink() : linkOf(block));
        setInvalid(false);
    };
    const emitText = () => {
        if (editor) {
            const html = editor.innerHTML;
            onChange(
                updateBlock(doc, block.id, (b) => ({ ...b, html }) as Block),
                `content:${block.id}`,
            );
        }
    };
    const text = useTextFormatting(block.type === 'text' ? editor : null, emitText, openLinkField);
    if (!location) return null;
    const { column, index } = location;

    const update = (next: Block, key?: string) =>
        onChange(
            updateBlock(doc, block.id, () => next),
            key,
        );
    const setStyles = (patch: object) =>
        update(
            { ...block, styles: { ...block.styles, ...patch } } as Block,
            fieldKey(block.id, patch),
        );

    const applyLink = () => {
        const href = normalizeLink(draft ?? '');
        if (!href) {
            setInvalid(true);
            return;
        }
        if (block.type === 'text') text.applyLink(href, draft!.trim());
        else if (block.type === 'button' || block.type === 'image') update({ ...block, href });
        setDraft(undefined);
    };
    const removeLink = () => {
        if (block.type === 'text') text.removeLink();
        else if (block.type === 'button') update({ ...block, href: '' });
        else if (block.type === 'image') update({ ...block, href: undefined });
        setDraft(undefined);
    };
    const closeLinkField = () => {
        if (block.type === 'text') text.cancelLink();
        setDraft(undefined);
    };
    const hasLink = block.type === 'text' ? text.link : linkOf(block) !== '';

    if (draft !== undefined) {
        return (
            <div
                ref={ref}
                className="mb-block-toolbar"
                style={{ marginLeft: -shift }}
                onClick={(event) => event.stopPropagation()}
            >
                <form
                    className="mb-link-form"
                    onSubmit={(event) => {
                        event.preventDefault();
                        applyLink();
                    }}
                >
                    <input
                        type="text"
                        aria-label="Link address"
                        aria-invalid={invalid}
                        placeholder="https://example.com"
                        value={draft}
                        autoFocus
                        onChange={(event) => {
                            setDraft(event.target.value);
                            setInvalid(false);
                        }}
                        onKeyDown={(event) => {
                            if (event.key === 'Escape') {
                                event.preventDefault();
                                closeLinkField();
                            }
                        }}
                    />
                    <button type="submit">Apply</button>
                    {hasLink && (
                        <button type="button" onClick={removeLink}>
                            Remove
                        </button>
                    )}
                    {invalid && (
                        <span className="mb-link-error" role="alert">
                            Use a web address, an email address or tel: with a phone number.
                        </span>
                    )}
                </form>
            </div>
        );
    }

    const align = alignOf(block);

    return (
        <div
            ref={ref}
            className="mb-block-toolbar"
            role="toolbar"
            aria-label="Block tools"
            style={{ marginLeft: -shift }}
            // Clicks here must not select the row behind or clear the selection.
            onClick={(event) => event.stopPropagation()}
        >
            {block.type === 'text' && (
                <Group>
                    <ToolButton
                        label="Bold"
                        shortcut="Ctrl+B"
                        pressed={text.bold}
                        onClick={() => text.run('bold')}
                    >
                        <strong>B</strong>
                    </ToolButton>
                    <ToolButton
                        label="Italic"
                        shortcut="Ctrl+I"
                        pressed={text.italic}
                        onClick={() => text.run('italic')}
                    >
                        <em>I</em>
                    </ToolButton>
                </Group>
            )}
            {block.type === 'button' && (
                <Group>
                    <ToolButton
                        label="Bold"
                        pressed={block.styles.bold}
                        onClick={() => setStyles({ bold: !block.styles.bold })}
                    >
                        <strong>B</strong>
                    </ToolButton>
                </Group>
            )}
            {(block.type === 'text' || block.type === 'button' || block.type === 'image') && (
                <Group>
                    <ToolButton
                        label="Link"
                        shortcut={block.type === 'text' ? 'Ctrl+K' : undefined}
                        pressed={hasLink}
                        onClick={openLinkField}
                    >
                        <LinkIcon />
                    </ToolButton>
                </Group>
            )}
            {align && (
                <Group label="Align">
                    {(['left', 'center', 'right'] as const).map((value) => (
                        <ToolButton
                            key={value}
                            label={`Align ${value}`}
                            pressed={align === value}
                            onClick={() =>
                                setStyles(
                                    block.type === 'text' ? { textAlign: value } : { align: value },
                                )
                            }
                        >
                            <AlignIcon align={value} />
                        </ToolButton>
                    ))}
                </Group>
            )}
            <Group>
                <ToolButton
                    label="Move up"
                    disabled={index === 0}
                    onClick={() => onChange(moveBlock(doc, block.id, column.id, index - 1))}
                >
                    <ArrowIcon direction="up" />
                </ToolButton>
                <ToolButton
                    label="Move down"
                    disabled={index === column.blocks.length - 1}
                    onClick={() => onChange(moveBlock(doc, block.id, column.id, index + 1))}
                >
                    <ArrowIcon direction="down" />
                </ToolButton>
                <ToolButton
                    label="Duplicate"
                    shortcut="Ctrl+D"
                    onClick={() => {
                        const result = duplicateBlock(doc, block.id);
                        onChange(result.doc);
                        onSelect({ type: 'block', id: result.block.id });
                    }}
                >
                    <DuplicateIcon />
                </ToolButton>
                <ToolButton
                    label="Remove block"
                    shortcut="Delete"
                    danger
                    onClick={() => {
                        onChange(removeBlock(doc, block.id));
                        onSelect(undefined);
                    }}
                >
                    <TrashIcon />
                </ToolButton>
            </Group>
        </div>
    );
}

/** The alignment a block has, if it has one. */
function alignOf(block: Block): Align | undefined {
    switch (block.type) {
        case 'text':
            return block.styles.textAlign;
        case 'image':
        case 'button':
        case 'divider':
            return block.styles.align;
        case 'spacer':
            return undefined;
    }
}

/** The address a button or image links to, or ''. */
function linkOf(block: Block): string {
    return block.type === 'button' || block.type === 'image' ? (block.href ?? '') : '';
}

function Group({ label, children }: { label?: string; children: ReactNode }) {
    return (
        <div className="mb-tool-group" role={label ? 'group' : undefined} aria-label={label}>
            {children}
        </div>
    );
}

function ToolButton({
    label,
    shortcut,
    pressed,
    disabled,
    danger,
    onClick,
    children,
}: {
    label: string;
    shortcut?: string | undefined;
    pressed?: boolean;
    disabled?: boolean;
    danger?: boolean;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            className={danger ? 'mb-tool mb-tool-danger' : 'mb-tool'}
            aria-label={label}
            title={shortcut ? `${label} (${shortcut})` : label}
            aria-pressed={pressed}
            disabled={disabled}
            onMouseDown={keepSelection}
            onClick={onClick}
        >
            {children}
        </button>
    );
}
