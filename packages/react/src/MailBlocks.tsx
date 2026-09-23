import { findBlock, type EmailDocument, type Target } from '@mailblocks/core';
import { useState } from 'react';
import { Canvas } from './Canvas';
import { Inspector } from './Inspector';

/** Clients checked when the `targets` prop is not given. */
export const DEFAULT_TARGETS: Target[] = [
    { family: 'gmail', platform: 'desktop-webmail' },
    { family: 'outlook', platform: 'windows' },
    { family: 'apple-mail', platform: 'ios' },
];

export interface MailBlocksProps {
    /** The document to edit. The component is controlled: it never mutates this. */
    document: EmailDocument;
    /** Called with a new document after every edit. */
    onChange: (document: EmailDocument) => void;
    /** Email clients the inspector warns about. */
    targets?: Target[];
}

/**
 * The editor: a canvas showing the document with editable blocks, and an
 * inspector for the selected block's styles and compatibility warnings.
 */
export function MailBlocks({
    document: doc,
    onChange,
    targets = DEFAULT_TARGETS,
}: MailBlocksProps) {
    const [selectedBlockId, setSelectedBlockId] = useState<string>();
    // Resolve on every render so a removed block simply stops being selected.
    const selected = selectedBlockId ? findBlock(doc, selectedBlockId) : undefined;

    return (
        <div className="mb-editor">
            <Canvas
                doc={doc}
                onChange={onChange}
                selectedBlockId={selected?.block.id}
                onSelect={setSelectedBlockId}
            />
            <Inspector doc={doc} onChange={onChange} selected={selected} targets={targets} />
        </div>
    );
}
