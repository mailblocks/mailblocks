/** Which colours the canvas shows the email in. */
export type ColorScheme = 'light' | 'dark';

/**
 * `styles` as shown in `scheme`: in dark mode, each dark colour that is set
 * (`darkColor`, `darkBackgroundColor`, …) replaces its light counterpart
 * (`color`, `backgroundColor`, …), as clients with dark colours do.
 */
export function withScheme<S extends object>(styles: S, scheme: ColorScheme): S {
    if (scheme === 'light') return styles;
    const result: Record<string, unknown> = { ...(styles as Record<string, unknown>) };
    for (const [key, value] of Object.entries(styles)) {
        const match = /^dark([A-Z])(.*)$/.exec(key);
        if (match && value !== undefined) result[match[1]!.toLowerCase() + match[2]!] = value;
    }
    return result as S;
}
