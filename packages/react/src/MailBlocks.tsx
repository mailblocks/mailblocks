import {
    canRedo,
    canUndo,
    clientReport,
    createHistory,
    findBlock,
    recordChange,
    redo,
    undo,
    type EmailDocument,
    type History,
    type Target,
} from '@mailblocks/core';
import { useMemo, useState, type KeyboardEvent } from 'react';
import { Canvas } from './Canvas';
import { ClientReport } from './ClientReport';
import { Inspector } from './Inspector';
import type { Selection } from './selection';

/** Clients checked when the `targets` prop is not given. */
export const DEFAULT_TARGETS: Target[] = [
    { family: 'gmail', platform: 'desktop-webmail' },
    { family: 'outlook', platform: 'windows' },
    { family: 'apple-mail', platform: 'ios' },
];

export interface MailBlocksProps {
    /** The document to edit. The component is controlled: it never mutates this. */
    document: EmailDocument;
    /** Called with a new document after every edit, undo and redo. */
    onChange: (document: EmailDocument) => void;
    /** Email clients the inspector warns about. */
    targets?: Target[];
}

/**
 * The editor: a toolbar with undo/redo, a canvas showing the document with
 * editable blocks, and an inspector for the selected block (styles and
 * compatibility warnings), the selected row, or the whole email.
 *
 * Undo history lives inside the component and covers the edits made through
 * it. When the host passes a document the editor did not produce, the history
 * starts over from that document.
 */
export function MailBlocks({
    document: doc,
    onChange,
    targets = DEFAULT_TARGETS,
}: MailBlocksProps) {
    const [selection, setSelection] = useState<Selection>();
    const [panel, setPanel] = useState<'inspector' | 'clients'>('inspector');
    const [preview, setPreview] = useState<'desktop' | 'mobile'>('desktop');
    const [history, setHistory] = useState(() => createHistory(doc));

    // A document from outside (a load, or an edit the host did not apply)
    // makes the old history meaningless, so start over from it.
    let current = history;
    if (doc !== history.present) {
        current = createHistory(doc);
        setHistory(current);
    }

    const change = (next: EmailDocument, mergeKey?: string) => {
        setHistory(recordChange(current, next, { key: mergeKey }));
        onChange(next);
    };

    const travel = (next: History) => {
        if (next === current) return;
        setHistory(next);
        onChange(next.present);
    };

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
        const key = event.key.toLowerCase();
        if (key === 'z' && !event.shiftKey) {
            event.preventDefault();
            travel(undo(current));
        } else if ((key === 'z' && event.shiftKey) || key === 'y') {
            event.preventDefault();
            travel(redo(current));
        }
    };

    // Selecting something on the canvas brings the inspector back.
    const select = (next: Selection | undefined) => {
        setSelection(next);
        if (next) setPanel('inspector');
    };

    // Only worked out while the report is on screen: it checks every client.
    const report = useMemo(() => (panel === 'clients' ? clientReport(doc) : []), [doc, panel]);

    // Resolve on every render so a removed block or row simply stops being selected.
    const selectedBlock = selection?.type === 'block' ? findBlock(doc, selection.id) : undefined;
    const rowIndex =
        selection?.type === 'row' ? doc.rows.findIndex((row) => row.id === selection.id) : -1;
    const selectedRow = rowIndex >= 0 ? { row: doc.rows[rowIndex]!, index: rowIndex } : undefined;

    return (
        <div className="mb-editor" onKeyDown={onKeyDown}>
            <div className="mb-main">
                <div className="mb-toolbar">
                    <button
                        type="button"
                        title="Undo (Ctrl+Z)"
                        disabled={!canUndo(current)}
                        onClick={() => travel(undo(current))}
                    >
                        Undo
                    </button>
                    <button
                        type="button"
                        title="Redo (Ctrl+Shift+Z)"
                        disabled={!canRedo(current)}
                        onClick={() => travel(redo(current))}
                    >
                        Redo
                    </button>
                    <span className="mb-toolbar-spacer" />
                    <div className="mb-toolbar-group" role="group" aria-label="Preview">
                        <button
                            type="button"
                            aria-pressed={preview === 'desktop'}
                            onClick={() => setPreview('desktop')}
                        >
                            Desktop
                        </button>
                        <button
                            type="button"
                            aria-pressed={preview === 'mobile'}
                            onClick={() => setPreview('mobile')}
                        >
                            Mobile
                        </button>
                    </div>
                </div>
                <Canvas
                    doc={doc}
                    preview={preview}
                    onChange={change}
                    selection={selection}
                    onSelect={select}
                />
            </div>
            <aside className="mb-side">
                <div className="mb-tabs" role="tablist" aria-label="Side panel">
                    <button
                        type="button"
                        role="tab"
                        aria-selected={panel === 'inspector'}
                        onClick={() => setPanel('inspector')}
                    >
                        Inspector
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={panel === 'clients'}
                        onClick={() => setPanel('clients')}
                    >
                        Clients
                    </button>
                </div>
                {panel === 'inspector' ? (
                    <Inspector
                        doc={doc}
                        onChange={change}
                        selectedBlock={selectedBlock}
                        selectedRow={selectedRow}
                        targets={targets}
                    />
                ) : (
                    <div className="mb-inspector mb-report">
                        <ClientReport
                            doc={doc}
                            report={report}
                            targets={targets}
                            onShow={(next) => {
                                setSelection(next);
                                setPanel('inspector');
                            }}
                        />
                    </div>
                )}
            </aside>
        </div>
    );
}
