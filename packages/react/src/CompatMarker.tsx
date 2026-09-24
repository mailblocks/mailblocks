import type { CompatWarning } from '@mailblocks/core';
import { describeWarning } from './labels';

/** Most severe first: a marker takes the colour of its worst warning. */
const SEVERITY: CompatWarning['level'][] = ['n', 'a', 'u'];

interface CompatMarkerProps {
    warnings: readonly CompatWarning[];
    /** What the marker belongs to, for its accessible name ("Text block", "Row 2"). */
    subject: string;
    onClick: () => void;
    className?: string;
}

/**
 * A small badge on the canvas for a block, row or email that has compatibility
 * warnings for the editor's targets. Its colour is the worst level, its
 * tooltip lists the warnings, and clicking it shows them in the inspector.
 * Renders nothing when there are no warnings.
 */
export function CompatMarker({ warnings, subject, onClick, className }: CompatMarkerProps) {
    const level = SEVERITY.find((l) => warnings.some((warning) => warning.level === l));
    if (!level) return null;
    const count =
        warnings.length === 1 ? '1 compatibility issue' : `${warnings.length} compatibility issues`;

    return (
        <button
            type="button"
            className={['mb-marker', `mb-marker-${level}`, className].filter(Boolean).join(' ')}
            aria-label={`${subject}: ${count}`}
            title={warnings.map(describeWarning).join('\n')}
            onClick={(event) => {
                event.stopPropagation();
                onClick();
            }}
        >
            {warnings.length}
        </button>
    );
}
