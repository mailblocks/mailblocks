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
