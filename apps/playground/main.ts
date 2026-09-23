import {
    check,
    createEmptyDocument,
    createRow,
    createTextBlock,
    exportHtml,
    features,
    lastUpdate,
    type CompatWarning,
    type EmailDocument,
    type Family,
    type Platform,
    type Target,
} from '@mailblocks/core';

const $ = <T extends HTMLElement>(id: string): T => {
    const element = document.getElementById(id);
    if (!element) throw new Error(`Missing #${id}`);
    return element as T;
};

const documentJson = $<HTMLTextAreaElement>('document-json');
const documentStatus = $<HTMLParagraphElement>('document-status');
const targetsContainer = $<HTMLDivElement>('targets');
const preview = $<HTMLIFrameElement>('preview');
const warningsList = $<HTMLUListElement>('warnings');
const warningsCount = $<HTMLSpanElement>('warnings-count');

$('data-version').textContent = `Can I Email data from ${lastUpdate.slice(0, 10)}`;

// ---------------------------------------------------------------------------
// Targets: every family/platform pair Can I Email has data for.

const DEFAULT_TARGETS: Target[] = [
    { family: 'gmail', platform: 'desktop-webmail' },
    { family: 'outlook', platform: 'windows' },
    { family: 'apple-mail', platform: 'ios' },
];

function allTargets(): Target[] {
    const seen = new Map<string, Target>();
    for (const feature of Object.values(features)) {
        for (const [family, platforms] of Object.entries(feature.stats)) {
            for (const platform of Object.keys(platforms ?? {})) {
                seen.set(`${family}/${platform}`, {
                    family: family as Family,
                    platform: platform as Platform,
                });
            }
        }
    }
    return [...seen.values()].sort((a, b) =>
        `${a.family}/${a.platform}`.localeCompare(`${b.family}/${b.platform}`),
    );
}

function renderTargets(): void {
    let currentFamily = '';
    for (const target of allTargets()) {
        if (target.family !== currentFamily) {
            currentFamily = target.family;
            const heading = document.createElement('div');
            heading.className = 'family';
            heading.textContent = target.family;
            targetsContainer.append(heading);
        }
        const label = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = `${target.family}/${target.platform}`;
        checkbox.checked = DEFAULT_TARGETS.some(
            (t) => t.family === target.family && t.platform === target.platform,
        );
        checkbox.addEventListener('change', update);
        label.append(checkbox, target.platform);
        targetsContainer.append(label);
    }
}

function selectedTargets(): Target[] {
    return [...targetsContainer.querySelectorAll<HTMLInputElement>('input:checked')].map(
        (input) => {
            const [family, platform] = input.value.split('/') as [Family, Platform];
            return { family, platform };
        },
    );
}

// ---------------------------------------------------------------------------
// Document: edited as JSON in the textarea.

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
        createTextBlock(
            '<p>Edit the JSON on the left and watch the preview and warnings update.</p>',
        ),
    );

    const columns = createRow(2);
    columns.columns[0]?.blocks.push(createTextBlock('<p>Left column.</p>'));
    columns.columns[1]?.blocks.push(createTextBlock('<p>Right column.</p>'));

    doc.rows.push(hero, columns);
    return doc;
}

function parseDocument(): EmailDocument | undefined {
    try {
        const doc = JSON.parse(documentJson.value) as EmailDocument;
        documentStatus.textContent = `${doc.rows.length} row(s)`;
        documentStatus.classList.remove('error');
        return doc;
    } catch (error) {
        documentStatus.textContent = error instanceof Error ? error.message : String(error);
        documentStatus.classList.add('error');
        return undefined;
    }
}

// ---------------------------------------------------------------------------
// Preview and warnings.

let currentHtml = '';

function renderWarnings(warnings: CompatWarning[]): void {
    warningsList.replaceChildren();
    warningsCount.textContent = warnings.length ? `(${warnings.length})` : '';
    if (warnings.length === 0) {
        const empty = document.createElement('li');
        empty.className = 'empty';
        empty.textContent = 'No warnings for the selected targets.';
        warningsList.append(empty);
        return;
    }
    for (const warning of warnings) {
        const item = document.createElement('li');
        const level = document.createElement('span');
        level.className = `level level-${warning.level}`;
        level.textContent = { n: 'not supported', a: 'partial', u: 'unknown' }[warning.level];
        const title = document.createElement('strong');
        title.textContent = `${warning.property} in ${warning.target.family} ${warning.target.platform}`;
        const meta = document.createElement('div');
        meta.className = 'meta';
        const subject =
            warning.subject.type === 'document'
                ? 'email settings'
                : `${warning.subject.type} ${warning.subject.id.slice(0, 8)}`;
        meta.textContent = `${warning.feature}, tested on ${warning.version}, ${subject}`;
        item.append(level, title, meta);
        if (warning.notes.length) {
            const notes = document.createElement('ul');
            notes.className = 'notes';
            for (const note of warning.notes) {
                const li = document.createElement('li');
                li.textContent = note;
                notes.append(li);
            }
            item.append(notes);
        }
        warningsList.append(item);
    }
}

function update(): void {
    const doc = parseDocument();
    if (!doc) return;
    currentHtml = exportHtml(doc);
    preview.srcdoc = currentHtml;
    renderWarnings(check(doc, selectedTargets()));
}

// ---------------------------------------------------------------------------
// Wiring.

renderTargets();
documentJson.value = JSON.stringify(sampleDocument(), null, 2);
documentJson.addEventListener('input', update);

$('copy-html').addEventListener('click', () => {
    void navigator.clipboard.writeText(currentHtml);
});

$('download-html').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([currentHtml], { type: 'text/html' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'mailblocks-email.html';
    link.click();
    URL.revokeObjectURL(url);
});

update();
