import type { CompatWarning } from '@mailblocks/core';

const LEVEL_LABEL: Record<CompatWarning['level'], string> = {
    n: 'not supported',
    a: 'partial',
    u: 'unknown',
};

/** Compatibility warnings, as shown at the bottom of every inspector panel. */
export function Warnings({ warnings }: { warnings: CompatWarning[] }) {
    return (
        <>
            <h3>
                Warnings <span className="mb-muted">({warnings.length})</span>
            </h3>
            {warnings.length === 0 ? (
                <p className="mb-muted">No warnings for the selected targets.</p>
            ) : (
                <ul className="mb-warnings">
                    {warnings.map((warning) => (
                        <li
                            key={`${warning.property}/${warning.target.family}/${warning.target.platform}`}
                        >
                            <span className={`mb-level mb-level-${warning.level}`}>
                                {LEVEL_LABEL[warning.level]}
                            </span>
                            <strong>{warning.property}</strong> in {warning.target.family}{' '}
                            {warning.target.platform}
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
            )}
        </>
    );
}
