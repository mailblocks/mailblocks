import { useId, useRef, type ChangeEvent, type KeyboardEvent, type ReactNode } from 'react';
import { AlignIcon, LineStyleIcon } from './icons';

/** Inputs and helpers shared by the inspector panels. */

/** Merge key for edits of the given fields of one thing (a block, a row, the document). */
export function fieldKey(id: string, patch: object): string {
    return `field:${id}:${Object.keys(patch).join(',')}`;
}

/** An input change handler that passes the value on as a number. */
export function numeric(apply: (value: number) => void) {
    return (event: ChangeEvent<HTMLInputElement>) => apply(Number(event.target.value));
}

export interface Padding {
    paddingTop: number;
    paddingRight: number;
    paddingBottom: number;
    paddingLeft: number;
}

export function PaddingFields({
    styles,
    onChange,
    legend = 'Padding',
}: {
    styles: Padding;
    onChange: (patch: Partial<Padding>) => void;
    legend?: string;
}) {
    const sides = ['Top', 'Right', 'Bottom', 'Left'] as const;
    return (
        <fieldset>
            <legend>{legend}</legend>
            {sides.map((side) => {
                const key = `padding${side}` as const;
                return (
                    <label key={side}>
                        {side}
                        <input
                            type="number"
                            min={0}
                            value={styles[key]}
                            onChange={numeric((value) => onChange({ [key]: value }))}
                        />
                    </label>
                );
            })}
        </fieldset>
    );
}

export interface Choice<T extends string> {
    value: T;
    /** Accessible name and tooltip, since the button only shows an icon. */
    label: string;
    icon: ReactNode;
}

/**
 * A row of icon buttons for picking one value, e.g. an alignment. Behaves as a
 * radio group: one tab stop, arrow keys move the choice.
 */
export function ChoiceField<T extends string>({
    label,
    value,
    choices,
    onChange,
}: {
    label: string;
    value: T | undefined;
    choices: readonly Choice<T>[];
    onChange: (value: T) => void;
}) {
    const id = useId();
    const buttons = useRef<(HTMLButtonElement | null)[]>([]);
    const selected = choices.findIndex((choice) => choice.value === value);

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
        if (!step) return;
        event.preventDefault();
        const next = (Math.max(selected, 0) + step + choices.length) % choices.length;
        onChange(choices[next]!.value);
        buttons.current[next]?.focus();
    };

    return (
        <div className="mb-field">
            <span id={id}>{label}</span>
            <div
                className="mb-choices"
                role="radiogroup"
                aria-labelledby={id}
                onKeyDown={onKeyDown}
            >
                {choices.map((choice, i) => {
                    const checked = i === selected;
                    return (
                        <button
                            key={choice.value}
                            ref={(element) => {
                                buttons.current[i] = element;
                            }}
                            type="button"
                            role="radio"
                            aria-checked={checked}
                            aria-label={choice.label}
                            title={choice.label}
                            tabIndex={checked || (selected === -1 && i === 0) ? 0 : -1}
                            className={checked ? 'mb-choice mb-choice-selected' : 'mb-choice'}
                            onClick={() => onChange(choice.value)}
                        >
                            {choice.icon}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

type Align = 'left' | 'center' | 'right';

export const ALIGN_CHOICES: Choice<Align>[] = [
    { value: 'left', label: 'Left', icon: <AlignIcon align="left" /> },
    { value: 'center', label: 'Center', icon: <AlignIcon align="center" /> },
    { value: 'right', label: 'Right', icon: <AlignIcon align="right" /> },
];

type LineStyle = 'solid' | 'dashed' | 'dotted';

export const LINE_STYLE_CHOICES: Choice<LineStyle>[] = [
    { value: 'solid', label: 'Solid', icon: <LineStyleIcon lineStyle="solid" /> },
    { value: 'dashed', label: 'Dashed', icon: <LineStyleIcon lineStyle="dashed" /> },
    { value: 'dotted', label: 'Dotted', icon: <LineStyleIcon lineStyle="dotted" /> },
];
