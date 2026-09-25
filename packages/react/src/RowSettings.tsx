import {
    checkRow,
    moveRow,
    removeRow,
    resizeColumn,
    setRowColumns,
    updateRowStyles,
    type EmailDocument,
    type LintIssue,
    type Row,
    type RowStyles,
    type Target,
} from '@mailblocks/core';
import {
    ChoiceField,
    ColorField,
    DarkModeFields,
    fieldKey,
    numeric,
    Section,
    type Choice,
} from './fields';
import { ColumnsIcon } from './icons';
import { Warnings } from './Warnings';

/**
 * Most columns a row can have. At the usual 600px content width, six columns
 * are 100px each, about the narrowest that still holds a word or an icon.
 */
export const MAX_COLUMNS = 6;

/** Narrowest a column can be made, in percent of the row. */
const MIN_COLUMN_WIDTH = 10;

/** Common column layouts, as percentage widths. */
const LAYOUTS: { id: string; label: string; widths: number[] }[] = [
    { id: '1', label: '1 column', widths: [100] },
    { id: '2', label: '2 columns', widths: [50, 50] },
    { id: '1-2', label: '1/3 + 2/3', widths: [100 / 3, 200 / 3] },
    { id: '2-1', label: '2/3 + 1/3', widths: [200 / 3, 100 / 3] },
    { id: '3', label: '3 columns', widths: [100 / 3, 100 / 3, 100 / 3] },
    { id: '4', label: '4 columns', widths: [25, 25, 25, 25] },
];

const LAYOUT_CHOICES: Choice<string>[] = LAYOUTS.map((layout) => ({
    value: layout.id,
    label: layout.label,
    icon: <ColumnsIcon widths={layout.widths} />,
}));

const sameWidths = (a: readonly number[], b: readonly number[]) =>
    a.length === b.length &&
    a.every((width, i) => Math.round(width * 100) === Math.round(b[i]! * 100));

const equalWidths = (count: number) => Array.from({ length: count }, () => 100 / count);

/** Percentages with up to two decimals, without trailing zeros (33.33, 50). */
const formatWidth = (width: number) => String(Math.round(width * 100) / 100);

interface RowSettingsProps {
    doc: EmailDocument;
    row: Row;
    index: number;
    onChange: (doc: EmailDocument, mergeKey?: string) => void;
    targets: Target[];
    issues: readonly LintIssue[];
}

/** Settings of the selected row: layout, background, spacing, order. */
export function RowSettings({ doc, row, index, onChange, targets, issues }: RowSettingsProps) {
    const s = row.styles;
    const set = (patch: Partial<RowStyles>) =>
        onChange(updateRowStyles(doc, row.id, patch), fieldKey(row.id, patch));
    const widths = row.columns.map((column) => column.width);
    const layout = LAYOUTS.find((option) => sameWidths(option.widths, widths));
    const count = widths.length;

    return (
        <>
            <Section title="Row">
                <ChoiceField
                    label="Layout"
                    value={layout?.id}
                    choices={LAYOUT_CHOICES}
                    onChange={(id) => {
                        const chosen = LAYOUTS.find((option) => option.id === id);
                        if (chosen) onChange(setRowColumns(doc, row.id, chosen.widths));
                    }}
                />
                <div className="mb-field">
                    <span>Columns</span>
                    <div className="mb-stepper">
                        <button
                            type="button"
                            aria-label="Remove column"
                            title="Remove column"
                            disabled={count === 1}
                            onClick={() =>
                                onChange(setRowColumns(doc, row.id, equalWidths(count - 1)))
                            }
                        >
                            −
                        </button>
                        <output aria-label="Column count">{count}</output>
                        <button
                            type="button"
                            aria-label="Add column"
                            title="Add column"
                            disabled={count === MAX_COLUMNS}
                            onClick={() =>
                                onChange(setRowColumns(doc, row.id, equalWidths(count + 1)))
                            }
                        >
                            +
                        </button>
                    </div>
                </div>
                {count > 1 && (
                    <fieldset>
                        <legend>Column widths (%)</legend>
                        {widths.map((width, i) => (
                            <label key={row.columns[i]!.id}>
                                Column {i + 1}
                                <input
                                    // Remount when the width changes elsewhere (undo, a layout, a neighbour).
                                    key={formatWidth(width)}
                                    type="number"
                                    min={MIN_COLUMN_WIDTH}
                                    max={100 - MIN_COLUMN_WIDTH}
                                    step={1}
                                    defaultValue={formatWidth(width)}
                                    // Applied on blur or Enter, not per keystroke: typing "45" would
                                    // otherwise pass through "4", which is clamped to the minimum.
                                    onBlur={(event) => {
                                        const next = Number(event.target.value);
                                        if (
                                            !Number.isFinite(next) ||
                                            formatWidth(next) === formatWidth(width)
                                        )
                                            return;
                                        onChange(
                                            resizeColumn(doc, row.id, i, next, MIN_COLUMN_WIDTH),
                                        );
                                    }}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') event.currentTarget.blur();
                                    }}
                                />
                            </label>
                        ))}
                    </fieldset>
                )}
                {count > 1 && (
                    <label title="Put the columns below each other on screens narrower than the email">
                        Stack on phones
                        <input
                            type="checkbox"
                            checked={s.stackOnMobile !== false}
                            onChange={(event) => set({ stackOnMobile: event.target.checked })}
                        />
                    </label>
                )}
                <label>
                    Background
                    <input
                        type="checkbox"
                        checked={s.backgroundColor !== undefined}
                        onChange={(event) =>
                            set({
                                backgroundColor: event.target.checked
                                    ? doc.styles.contentBackgroundColor
                                    : undefined,
                            })
                        }
                    />
                </label>
                {s.backgroundColor !== undefined && (
                    <ColorField
                        label="Background color"
                        value={s.backgroundColor}
                        onChange={(backgroundColor) => set({ backgroundColor })}
                    />
                )}
            </Section>
            <Section title="Spacing">
                <fieldset className="mb-grid">
                    <legend>Padding</legend>
                    <label>
                        Top
                        <input
                            type="number"
                            min={0}
                            value={s.paddingTop}
                            onChange={numeric((paddingTop) => set({ paddingTop }))}
                        />
                    </label>
                    <label>
                        Bottom
                        <input
                            type="number"
                            min={0}
                            value={s.paddingBottom}
                            onChange={numeric((paddingBottom) => set({ paddingBottom }))}
                        />
                    </label>
                </fieldset>
            </Section>
            <DarkModeFields
                colors={[
                    {
                        label: 'Dark background',
                        value: s.darkBackgroundColor,
                        // A row without its own background shows the content's.
                        light: s.backgroundColor ?? doc.styles.contentBackgroundColor,
                        onChange: (darkBackgroundColor) => set({ darkBackgroundColor }),
                    },
                ]}
            />

            <div className="mb-block-actions">
                <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => onChange(moveRow(doc, row.id, index - 1))}
                >
                    Move row up
                </button>
                <button
                    type="button"
                    disabled={index === doc.rows.length - 1}
                    onClick={() => onChange(moveRow(doc, row.id, index + 1))}
                >
                    Move row down
                </button>
                <button
                    type="button"
                    className="mb-remove"
                    onClick={() => onChange(removeRow(doc, row.id))}
                >
                    Remove row
                </button>
            </div>
            <Warnings warnings={checkRow(row, targets)} issues={issues} />
        </>
    );
}
