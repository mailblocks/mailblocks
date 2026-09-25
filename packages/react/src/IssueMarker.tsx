import type { CompatWarning, LintIssue } from '@mailblocks/core';
import { describeWarning } from './labels';

interface IssueMarkerProps {
    /** Compatibility warnings for the editor's targets. */
    warnings: readonly CompatWarning[];
    /** Problems found by `lint()`: links, alt text, contrast, size. */
    issues: readonly LintIssue[];
    /** What the marker belongs to, for its accessible name ("Text block", "Row 2"). */
    subject: string;
    onClick: () => void;
    className?: string;
}

/** The marker's colour: red, orange or grey, like the warning badges. */
function levelOf(warnings: readonly CompatWarning[], issues: readonly LintIssue[]) {
    if (issues.some((i) => i.severity === 'error') || warnings.some((w) => w.level === 'n')) {
        return 'n';
    }
    if (issues.length > 0 || warnings.some((w) => w.level === 'a')) return 'a';
    return 'u';
}

/**
 * A small badge on the canvas for a block, row or email that has warnings or
 * issues. Its colour is the worst of them, its tooltip lists them, and
 * clicking it shows them in the inspector. Renders nothing when there are none.
 */
export function IssueMarker({ warnings, issues, subject, onClick, className }: IssueMarkerProps) {
    const count = warnings.length + issues.length;
    if (count === 0) return null;
    const level = levelOf(warnings, issues);
    const lines = [...issues.map((issue) => issue.message), ...warnings.map(describeWarning)];

    return (
        <button
            type="button"
            className={['mb-marker', `mb-marker-${level}`, className].filter(Boolean).join(' ')}
            aria-label={`${subject}: ${count === 1 ? '1 issue' : `${count} issues`}`}
            title={lines.join('\n')}
            onClick={(event) => {
                event.stopPropagation();
                onClick();
            }}
        >
            {count}
        </button>
    );
}
