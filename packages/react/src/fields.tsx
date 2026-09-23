import type { ChangeEvent } from 'react';

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
