import {
    createEmptyDocument,
    createRow,
    createTextBlock,
    exportHtml,
    type EmailDocument,
} from '@mailblocks/core';
import { MailBlocks, type MailBlocksProps } from '@mailblocks/react';
import '@mailblocks/react/styles.css';
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

function sampleDocument(): EmailDocument {
    const doc = createEmptyDocument();

    const hero = createRow();
    hero.styles.paddingTop = 20;
    hero.styles.paddingBottom = 20;
    const title = createTextBlock('<p><strong>Hello from mailblocks</strong></p>');
    title.styles.fontSize = 28;
    title.styles.textAlign = 'center';
    hero.columns[0]?.blocks.push(
        title,
        createTextBlock('<p>Click a block to edit it. Type straight into the text.</p>'),
    );

    const columns = createRow(2);
    columns.columns[0]?.blocks.push(createTextBlock('<p>Left column.</p>'));
    columns.columns[1]?.blocks.push(createTextBlock('<p>Right column.</p>'));

    doc.rows.push(hero, columns);
    return doc;
}

function App() {
    const [doc, setDoc] = useState(sampleDocument);
    const [showPreview, setShowPreview] = useState(false);
    const [theme, setTheme] = useState<MailBlocksProps['theme']>('system');

    return (
        <div className="app">
            <header>
                <strong>mailblocks react playground</strong>
                <span className="spacer" />
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
                <button type="button" onClick={() => setShowPreview((value) => !value)}>
                    {showPreview ? 'Hide export' : 'Show export'}
                </button>
            </header>
            <div className="editor">
                <MailBlocks document={doc} onChange={setDoc} theme={theme} />
            </div>
            {showPreview && (
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
