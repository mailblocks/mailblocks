/**
 * Small inline SVG icons for the inspector. Drawn with `currentColor` so they
 * follow the button's text colour; no icon font or package needed.
 */

import type { ReactNode } from 'react';

function Icon({ children, width = 16 }: { children: ReactNode; width?: number }) {
    return (
        <svg
            width={width}
            height={16}
            viewBox={`0 0 ${width} 16`}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            aria-hidden="true"
            focusable="false"
        >
            {children}
        </svg>
    );
}

/** Three lines lined up to the left, centre or right. */
export function AlignIcon({ align }: { align: 'left' | 'center' | 'right' }) {
    const lines: [number, number][] = [
        [2, 14],
        [2, 10],
        [2, 12],
    ];
    const y = [4, 8, 12];
    return (
        <Icon>
            {lines.map(([start, end], i) => {
                const length = end - start;
                const x = align === 'left' ? 2 : align === 'right' ? 14 - length : 8 - length / 2;
                return <line key={i} x1={x} y1={y[i]} x2={x + length} y2={y[i]} />;
            })}
        </Icon>
    );
}

/** A horizontal line in the given style. */
export function LineStyleIcon({ lineStyle }: { lineStyle: 'solid' | 'dashed' | 'dotted' }) {
    const dash = lineStyle === 'dashed' ? '4 3' : lineStyle === 'dotted' ? '0.1 3' : undefined;
    return (
        <Icon width={24}>
            <line
                x1={2}
                y1={8}
                x2={22}
                y2={8}
                strokeWidth={lineStyle === 'dotted' ? 2.5 : 2}
                strokeDasharray={dash}
            />
        </Icon>
    );
}

/** Boxes side by side, as wide as the given column percentages. */
export function ColumnsIcon({ widths }: { widths: readonly number[] }) {
    const total = 22;
    const gap = 1.5;
    const usable = total - gap * (widths.length - 1);
    let x = 1;
    return (
        <Icon width={24}>
            {widths.map((width, i) => {
                const w = (usable * width) / 100;
                const rect = (
                    <rect key={i} x={x} y={3} width={w} height={10} rx={1} strokeWidth={1.2} />
                );
                x += w + gap;
                return rect;
            })}
        </Icon>
    );
}

/** Two chain links. */
export function LinkIcon() {
    return (
        <Icon>
            <path d="M7 9.5a3 3 0 0 0 4.2 0l2.3-2.3a3 3 0 0 0-4.2-4.2L8.2 4.1" />
            <path d="M9 6.5a3 3 0 0 0-4.2 0L2.5 8.8a3 3 0 0 0 4.2 4.2l1.1-1.1" />
        </Icon>
    );
}

/** An arrow pointing up or down. */
export function ArrowIcon({ direction }: { direction: 'up' | 'down' }) {
    return (
        <Icon>
            {direction === 'up' ? (
                <path d="M8 13V3M4 7l4-4 4 4" strokeLinejoin="round" />
            ) : (
                <path d="M8 3v10M4 9l4 4 4-4" strokeLinejoin="round" />
            )}
        </Icon>
    );
}

/** Two overlapping sheets. */
export function DuplicateIcon() {
    return (
        <Icon>
            <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
            <path d="M10.5 3.5v-.5A1.5 1.5 0 0 0 9 1.5H4A1.5 1.5 0 0 0 2.5 3v5A1.5 1.5 0 0 0 4 9.5h.5" />
        </Icon>
    );
}

/** A bin. */
export function TrashIcon() {
    return (
        <Icon>
            <path
                d="M2.5 4.5h11M6.5 4.5V3h3v1.5M4 4.5l.7 9h6.6l.7-9M6.8 7v4M9.2 7v4"
                strokeLinejoin="round"
            />
        </Icon>
    );
}
