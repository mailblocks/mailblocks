import {
    findBlock,
    type ClientResult,
    type ClientStatus,
    type CompatWarning,
    type EmailDocument,
    type Target,
    type WarningSubject,
} from '@mailblocks/core';
import type { Selection } from './selection';

const SECTIONS: { status: ClientStatus; title: string; hint: string }[] = [
    { status: 'unsupported', title: 'Problems', hint: 'Something will not show as designed.' },
    { status: 'partial', title: 'Partial support', hint: 'Some styles only partly work.' },
    { status: 'unknown', title: 'Unknown', hint: 'Can I Email has no data for some styles.' },
    { status: 'ok', title: 'Works', hint: 'Nothing to report.' },
];

const LEVEL_LABEL: Record<CompatWarning['level'], string> = {
    n: 'not supported',
    a: 'partial',
    u: 'unknown',
};

const BLOCK_NAMES: Record<string, string> = {
    text: 'Text',
    image: 'Image',
    button: 'Button',
    divider: 'Divider',
    spacer: 'Spacer',
};

interface ClientReportProps {
    doc: EmailDocument;
    report: ClientResult[];
    targets: Target[];
    /** Show a subject in the inspector; `undefined` shows the email settings. */
    onShow: (selection: Selection | undefined) => void;
}

/** Every email client, grouped by how well this email renders there. */
export function ClientReport({ doc, report, targets, onShow }: ClientReportProps) {
    const isTarget = (t: Target) =>
        targets.some((target) => target.family === t.family && target.platform === t.platform);
    const works = report.filter((result) => result.status === 'ok').length;

    return (
        <>
            <h3>Clients</h3>
            <p className="mb-report-summary">
                Works without issues in <strong>{works}</strong> of {report.length} email clients.
            </p>
            {SECTIONS.map(({ status, title, hint }) => {
                const results = report.filter((result) => result.status === status);
                if (results.length === 0) return null;
                return (
                    <section key={status} className={`mb-report-section mb-status-${status}`}>
                        <h4>
                            {title} <span className="mb-muted">({results.length})</span>
                        </h4>
                        <p className="mb-muted">{hint}</p>
                        {status === 'ok' ? (
                            <ul className="mb-client-names">
                                {results.map((result) => (
                                    <li key={result.name}>
                                        {result.name}
                                        {isTarget(result.target) && <TargetTag />}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            results.map((result) => (
                                <details key={result.name} className="mb-client">
                                    <summary>
                                        <span className="mb-client-name">{result.name}</span>
                                        {isTarget(result.target) && <TargetTag />}
                                        <span className="mb-muted">
                                            {' '}
                                            {issueCount(result.warnings)}
                                        </span>
                                    </summary>
                                    <Issues doc={doc} warnings={result.warnings} onShow={onShow} />
                                </details>
                            ))
                        )}
                    </section>
                );
            })}
        </>
    );
}

function TargetTag() {
    return (
        <span className="mb-target-tag" title="One of the editor's target clients">
            target
        </span>
    );
}

function issueCount(warnings: CompatWarning[]): string {
    const count = groupWarnings(warnings).length;
    return count === 1 ? '1 issue' : `${count} issues`;
}

interface IssueGroup {
    warning: CompatWarning;
    subjects: WarningSubject[];
}

/** The same style problem on several blocks is listed once, with every place it occurs. */
function groupWarnings(warnings: CompatWarning[]): IssueGroup[] {
    const groups = new Map<string, IssueGroup>();
    for (const warning of warnings) {
        const key = `${warning.level}|${warning.feature}|${warning.property}`;
        const group = groups.get(key);
        if (group) group.subjects.push(warning.subject);
        else groups.set(key, { warning, subjects: [warning.subject] });
    }
    return [...groups.values()];
}

function Issues({
    doc,
    warnings,
    onShow,
}: {
    doc: EmailDocument;
    warnings: CompatWarning[];
    onShow: ClientReportProps['onShow'];
}) {
    return (
        <ul className="mb-warnings">
            {groupWarnings(warnings).map(({ warning, subjects }) => (
                <li key={`${warning.level}|${warning.feature}|${warning.property}`}>
                    <span className={`mb-level mb-level-${warning.level}`}>
                        {LEVEL_LABEL[warning.level]}
                    </span>
                    <strong>{warning.property}</strong>
                    <div className="mb-subjects">
                        {subjects.map((subject, i) => {
                            const { label, selection } = describeSubject(doc, subject);
                            return (
                                <button
                                    key={i}
                                    type="button"
                                    className="mb-subject"
                                    onClick={() => onShow(selection)}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                    {warning.notes.length > 0 && (
                        <ul className="mb-notes">
                            {warning.notes.map((note) => (
                                <li key={note}>{note}</li>
                            ))}
                        </ul>
                    )}
                </li>
            ))}
        </ul>
    );
}

/** A readable name for what a warning is about, and how to select it. */
function describeSubject(
    doc: EmailDocument,
    subject: WarningSubject,
): { label: string; selection: Selection | undefined } {
    switch (subject.type) {
        case 'document':
            return { label: 'Email settings', selection: undefined };
        case 'row': {
            const index = doc.rows.findIndex((row) => row.id === subject.id);
            return { label: `Row ${index + 1}`, selection: { type: 'row', id: subject.id } };
        }
        case 'block': {
            const location = findBlock(doc, subject.id);
            const rowIndex = location ? doc.rows.indexOf(location.row) : -1;
            const name = location ? (BLOCK_NAMES[location.block.type] ?? 'Block') : 'Block';
            return {
                label: rowIndex >= 0 ? `${name} in row ${rowIndex + 1}` : name,
                selection: { type: 'block', id: subject.id },
            };
        }
    }
}
