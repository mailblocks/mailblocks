import { exportHtml, type EmailDocument } from '@mailblocks/core';
import { MailBlocks, type MailBlocksProps } from '@mailblocks/react';
import '@mailblocks/react/styles.css';
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { sampleDocument } from './sample';
import './style.css';

const REPOSITORY = 'https://github.com/mailblocks/mailblocks';
const STORAGE_KEY = 'mailblocks-demo-document';

/** The document saved by an earlier visit, if there is a usable one. */
function savedDocument(): EmailDocument | undefined {
    try {
        const saved = JSON.parse(
            localStorage.getItem(STORAGE_KEY) ?? 'null',
        ) as EmailDocument | null;
        return saved?.version === 1 && Array.isArray(saved.rows) ? saved : undefined;
    } catch {
        return undefined;
    }
}

function save(doc: EmailDocument) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
    } catch {
        // Private windows and full storage: the demo still works, it just forgets.
    }
}

function download(html: string) {
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'email.html';
    link.click();
    URL.revokeObjectURL(url);
}

function App() {
    const [doc, setDoc] = useState(() => savedDocument() ?? sampleDocument());
    const [showExport, setShowExport] = useState(false);
    const [theme, setTheme] = useState<MailBlocksProps['theme']>('system');
    const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

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
                <button type="button" onClick={() => download(exportHtml(doc))}>
                    Download
                </button>
                <a className="github" href={REPOSITORY} target="_blank" rel="noreferrer">
                    GitHub
                </a>
            </header>
            <div className="editor">
                <MailBlocks document={doc} onChange={setDoc} theme={theme} />
            </div>
            {showExport && (
                <iframe className="preview" title="Exported email" srcDoc={exportHtml(doc)} />
            )}
        </div>
    );
}

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
