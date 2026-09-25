import type { WarningSubject } from '@mailblocks/core';

/** A string that identifies what a warning or issue is about. */
export const subjectKey = (subject: WarningSubject) =>
    subject.type === 'document' ? 'document' : `${subject.type}:${subject.id}`;

/** Items grouped by what they are about, looked up with {@link subjectKey}. */
export function bySubject<T extends { subject: WarningSubject }>(
    items: readonly T[],
): Map<string, T[]> {
    const groups = new Map<string, T[]>();
    for (const item of items) {
        const key = subjectKey(item.subject);
        groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    return groups;
}

/** The items about `subject`. */
export function about<T extends { subject: WarningSubject }>(
    items: readonly T[],
    subject: WarningSubject,
): T[] {
    const key = subjectKey(subject);
    return items.filter((item) => subjectKey(item.subject) === key);
}
