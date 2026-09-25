import {
    createContext,
    useContext,
    useId,
    useRef,
    useState,
    type ChangeEvent,
    type KeyboardEvent,
    type ReactNode,
} from 'react';
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

/** The four sides of a padding, two by two. */
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
        <fieldset className="mb-grid">
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

/** `#abc` or `#aabbcc`, in lower case with six digits; `undefined` when it is neither. */
export function normalizeHex(input: string): string | undefined {
    const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(input.trim());
    if (!match) return undefined;
    const digits = match[1]!.toLowerCase();
    return `#${digits.length === 3 ? [...digits].map((d) => d + d).join('') : digits}`;
}

/**
 * A colour: the browser's colour picker and the same colour as hex text, which
 * can be read and typed or pasted. The text is applied on blur or Enter, and
 * goes back to the colour when it is not one. `onClear`, when given, adds a
 * button that takes the colour away.
 */
export function ColorField({
    label,
    value,
    onChange,
    onClear,
    clearTitle,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    onClear?: (() => void) | undefined;
    clearTitle?: string;
}) {
    const id = useId();
    const apply = (input: HTMLInputElement) => {
        const hex = normalizeHex(input.value);
        if (hex && hex !== value.toLowerCase()) onChange(hex);
        else input.value = value;
    };
    return (
        <div className="mb-field">
            <label htmlFor={id}>{label}</label>
            <span className="mb-color">
                <input
                    id={id}
                    type="color"
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                />
                <input
                    // Remount when the colour changes elsewhere (the picker, undo).
                    key={value}
                    type="text"
                    aria-label={`${label} hex`}
                    defaultValue={value}
                    spellCheck={false}
                    maxLength={7}
                    onBlur={(event) => apply(event.currentTarget)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') event.currentTarget.blur();
                    }}
                />
                {onClear && (
                    <button
                        type="button"
                        className="mb-clear"
                        aria-label={`Clear ${label.toLowerCase()}`}
                        title={clearTitle}
                        onClick={onClear}
                    >
                        ×
                    </button>
                )}
            </span>
        </div>
    );
}

export interface DarkColor {
    label: string;
    /** The dark mode colour, or undefined to keep the light one. */
    value: string | undefined;
    /** The light mode colour, shown while no dark one is set. */
    light: string;
    onChange: (value: string | undefined) => void;
}

/**
 * Colours for dark mode. Each shows its light colour until one is picked; the
 * clear button goes back to the light colour.
 */
export function DarkModeFields({ colors }: { colors: readonly DarkColor[] }) {
    return (
        <Section title="Dark mode">
            {colors.map(({ label, value, light, onChange }) => (
                <ColorField
                    key={label}
                    label={label}
                    value={value ?? light}
                    onChange={onChange}
                    onClear={value !== undefined ? () => onChange(undefined) : undefined}
                    clearTitle="Same as in light mode"
                />
            ))}
        </Section>
    );
}

/** Which sections are folded, by title, so they stay folded from one selection to the next. */
const FoldedSections = createContext<{
    folded: ReadonlySet<string>;
    toggle: (title: string) => void;
}>({ folded: new Set(), toggle: () => {} });

/** Remembers the folded sections of everything inside it. */
export function SectionsProvider({ children }: { children: ReactNode }) {
    const [folded, setFolded] = useState<ReadonlySet<string>>(new Set());
    const toggle = (title: string) =>
        setFolded((current) => {
            const next = new Set(current);
            if (!next.delete(title)) next.add(title);
            return next;
        });
    return <FoldedSections.Provider value={{ folded, toggle }}>{children}</FoldedSections.Provider>;
}

/** A titled part of a panel that folds away with a click on its title. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
    const { folded, toggle } = useContext(FoldedSections);
    const open = !folded.has(title);
    const id = useId();
    return (
        <section className="mb-section">
            <h3>
                <button
                    type="button"
                    className="mb-section-toggle"
                    aria-expanded={open}
                    aria-controls={id}
                    onClick={() => toggle(title)}
                >
                    {title}
                </button>
            </h3>
            {open && (
                <div id={id} className="mb-section-body">
                    {children}
                </div>
            )}
        </section>
    );
}
