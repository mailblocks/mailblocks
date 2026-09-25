import { exportHtml, parseDocument, serializeDocument, type EmailDocument } from '@mailblocks/core';
import { cleanTextHtml, MailBlocks, type MailBlocksProps } from '@mailblocks/react';
import '@mailblocks/react/styles.css';
import { StrictMode, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { sampleDocument } from './sample';
import './style.css';

const REPOSITORY = 'https://github.com/mailblocks/mailblocks';
const STORAGE_KEY = 'mailblocks-demo-document';

/**
 * Reads a document from JSON that may come from anywhere: it is checked, and
 * its text is cleaned of anything a text block should not hold.
 */
const readDocument = (json: string) => parseDocument(json, { html: cleanTextHtml });

/** The document saved by an earlier visit, if there is a usable one. */
function savedDocument(): EmailDocument | undefined {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? readDocument(saved) : undefined;
    } catch {
        return undefined;
    }
}

function save(doc: EmailDocument) {
    try {
        localStorage.setItem(STORAGE_KEY, serializeDocument(doc));
    } catch {
        // Private windows and full storage: the demo still works, it just forgets.
    }
}

function download(content: string, name: string, type: string) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
}

function App() {
    const [doc, setDoc] = useState(() => savedDocument() ?? sampleDocument());
    const [showExport, setShowExport] = useState(false);
    const [theme, setTheme] = useState<MailBlocksProps['theme']>('system');
    const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
    const [message, setMessage] = useState<string>();
    const fileInput = useRef<HTMLInputElement>(null);

    useEffect(() => save(doc), [doc]);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(exportHtml(doc));
            setCopyState('copied');
        } catch {
            // The clipboard can be refused; Download still works.
            setCopyState('failed');
        }
        setTimeout(() => setCopyState('idle'), 1500);
    };

    const open = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        // Let the same file be chosen again after a fix.
        event.target.value = '';
        if (!file) return;
        try {
            setDoc(readDocument(await file.text()));
            setMessage(undefined);
        } catch (error) {
            setMessage(`Could not open ${file.name}: ${(error as Error).message}`);
        }
    };

    return (
        <div className="app">
            <header>
                <div className="brand">
                    <strong>mailblocks</strong>
                    <span className="tagline">
                        An email builder that knows which email clients will break your design.
                    </span>
                </div>
                <label>
                    Theme{' '}
                    <select
                        value={theme}
                        onChange={(event) => setTheme(event.target.value as typeof theme)}
                    >
                        <option value="system">System</option>
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                    </select>
                </label>
                <button
                    type="button"
                    title="Start over from the sample email"
                    onClick={() => setDoc(sampleDocument())}
                >
                    Reset
                </button>
                <button type="button" onClick={() => setShowExport((value) => !value)}>
                    {showExport ? 'Hide export' : 'Show export'}
                </button>
                <button type="button" onClick={copy}>
                    {{ idle: 'Copy HTML', copied: 'Copied', failed: 'Copy failed' }[copyState]}
                </button>
                <button
                    type="button"
                    onClick={() => download(exportHtml(doc), 'email.html', 'text/html')}
                >
                    Download HTML
                </button>
                <button
                    type="button"
                    title="Save the email as JSON, to open it again later"
                    onClick={() =>
                        download(serializeDocument(doc), 'email.json', 'application/json')
                    }
                >
                    Download JSON
                </button>
                <button
                    type="button"
                    title="Open an email saved as JSON"
                    onClick={() => fileInput.current?.click()}
                >
                    Open JSON
                </button>
                <input
                    ref={fileInput}
                    type="file"
                    accept=".json,application/json"
                    aria-label="Email JSON file"
                    hidden
                    onChange={open}
                />
                <a className="github" href={REPOSITORY} target="_blank" rel="noreferrer">
                    GitHub
                </a>
            </header>
            {message && (
                <div className="message" role="alert">
                    <span>{message}</span>
                    <button type="button" onClick={() => setMessage(undefined)}>
                        Dismiss
                    </button>
                </div>
            )}
            <div className="editor">
                <MailBlocks document={doc} onChange={setDoc} theme={theme} />
            </div>
            {showExport && (
                // No scripts: an opened file could hold markup that should not run here.
                // Same origin only so the email's images load as they would elsewhere.
                <iframe
                    className="preview"
                    title="Exported email"
                    sandbox="allow-same-origin"
                    srcDoc={exportHtml(doc)}
                />
            )}
        </div>
    );
}

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
