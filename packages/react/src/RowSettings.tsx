import {
    checkRow,
    moveRow,
    removeRow,
    setRowColumns,
    updateRowStyles,
    type EmailDocument,
    type Row,
    type RowStyles,
    type Target,
} from '@mailblocks/core';
import { fieldKey, numeric } from './fields';
import { Warnings } from './Warnings';

/** Column layouts offered for a row, as percentage widths. */
const LAYOUTS: { label: string; widths: number[] }[] = [
    { label: '1 column', widths: [100] },
    { label: '2 columns', widths: [50, 50] },
    { label: '1/3 + 2/3', widths: [100 / 3, 200 / 3] },
    { label: '2/3 + 1/3', widths: [200 / 3, 100 / 3] },
    { label: '3 columns', widths: [100 / 3, 100 / 3, 100 / 3] },
];

/** Index of the layout matching the row's column widths, or -1 for a custom one. */
function currentLayout(row: Row): number {
    const widths = row.columns.map((column) => Math.round(column.width * 100));
    return LAYOUTS.findIndex(
        (layout) =>
            layout.widths.length === widths.length &&
            layout.widths.every((width, i) => Math.round(width * 100) === widths[i]),
    );
}

interface RowSettingsProps {
    doc: EmailDocument;
    row: Row;
    index: number;
    onChange: (doc: EmailDocument, mergeKey?: string) => void;
    targets: Target[];
}

/** Settings of the selected row: layout, background, spacing, order. */
export function RowSettings({ doc, row, index, onChange, targets }: RowSettingsProps) {
    const s = row.styles;
    const set = (patch: Partial<RowStyles>) =>
        onChange(updateRowStyles(doc, row.id, patch), fieldKey(row.id, patch));
    const layout = currentLayout(row);

    return (
        <>
            <h3>Row</h3>
            <label>
                Columns
                <select
                    value={layout}
                    onChange={(event) => {
                        const chosen = LAYOUTS[Number(event.target.value)];
                        if (chosen) onChange(setRowColumns(doc, row.id, chosen.widths));
                    }}
                >
                    {layout === -1 && <option value={-1}>Custom</option>}
                    {LAYOUTS.map((option, i) => (
                        <option key={option.label} value={i}>
                            {option.label}
                        </option>
                    ))}
                </select>
            </label>
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
                <label>
                    Background color
                    <input
                        type="color"
                        value={s.backgroundColor}
                        onChange={(event) => set({ backgroundColor: event.target.value })}
                    />
                </label>
            )}
            <fieldset>
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
            <Warnings warnings={checkRow(row, targets)} />
        </>
    );
}
