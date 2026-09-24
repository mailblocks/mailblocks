import { featureUrl, targetName, type CompatWarning } from '@mailblocks/core';
import { explainWarning, LEVEL_LABEL, propertyLabel } from './labels';

/** Compatibility warnings, as shown at the bottom of every inspector panel. */
export function Warnings({ warnings }: { warnings: CompatWarning[] }) {
    return (
        <>
            <h3 className="mb-warnings-title">
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
                            <strong>{propertyLabel(warning.property)}</strong> in{' '}
                            {targetName(warning.target)}
                            <WarningDetails warning={warning} />
                        </li>
                    ))}
                </ul>
            )}
        </>
    );
}

/**
 * What a warning means, Can I Email's notes about it, and where the result
 * comes from, so it can be checked.
 */
export function WarningDetails({ warning }: { warning: CompatWarning }) {
    const explanation = explainWarning(warning);
    return (
        <>
            {explanation && <p className="mb-explanation">{explanation}</p>}
            {warning.notes.length > 0 && (
                <ul className="mb-notes">
                    {warning.notes.map((note) => (
                        <li key={note}>{note}</li>
                    ))}
                </ul>
            )}
            <p className="mb-source">
                <a href={featureUrl(warning.feature)} target="_blank" rel="noreferrer">
                    Can I Email
                </a>
                , tested version {warning.version}
            </p>
        </>
    );
}
