/**
 * Turns what someone typed as a link into an address an email can use, or
 * `undefined` when it is not one. Web, email and phone links are kept as they
 * are; a bare domain gets `https://` and a bare email address `mailto:`.
 * Anything else, such as `javascript:` or a relative path, is refused.
 */
export function normalizeLink(input: string): string | undefined {
    const value = input.trim();
    if (!value || /\s/.test(value)) return undefined;
    if (/^(https?:\/\/[^/]|mailto:.|tel:.)/i.test(value)) return value;
    if (/^[^@/:]+@[^@/:]+\.[^@/:]+$/.test(value)) return `mailto:${value}`;
    if (/^[\w-]+(\.[\w-]+)+(:\d+)?([/?#].*)?$/.test(value)) return `https://${value}`;
    return undefined;
}
