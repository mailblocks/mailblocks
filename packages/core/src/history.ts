import type { EmailDocument } from './model';

/**
 * Undo/redo history of a document. Documents are immutable, so the history is
 * simply the documents before and after the current one. Framework-agnostic:
 * the editor packages keep one of these in their state.
 */
export interface History {
    past: EmailDocument[];
    present: EmailDocument;
    future: EmailDocument[];
    /** Merge key and time of the last recorded change, used to group typing into one step. */
    last?: { key: string; time: number } | undefined;
}

export interface RecordOptions {
    /**
     * Changes recorded with the same key within `mergeWindow` milliseconds of
     * each other become a single undo step, e.g. every keystroke in one field.
     */
    key?: string | undefined;
    /** Current time in milliseconds. Defaults to `Date.now()`. */
    now?: number;
    /** Defaults to 1000 ms. */
    mergeWindow?: number;
    /** Maximum number of undo steps kept. Defaults to 100. */
    limit?: number;
}

export function createHistory(doc: EmailDocument): History {
    return { past: [], present: doc, future: [] };
}

/** Makes `next` the present document. Anything that was undone can no longer be redone. */
export function recordChange(
    history: History,
    next: EmailDocument,
    options: RecordOptions = {},
): History {
    const { key, now = Date.now(), mergeWindow = 1000, limit = 100 } = options;
    if (next === history.present) return history;

    const merge =
        key !== undefined &&
        history.last?.key === key &&
        now - history.last.time <= mergeWindow &&
        history.past.length > 0;

    return {
        past: merge ? history.past : [...history.past, history.present].slice(-limit),
        present: next,
        future: [],
        last: key === undefined ? undefined : { key, time: now },
    };
}

export function canUndo(history: History): boolean {
    return history.past.length > 0;
}

export function canRedo(history: History): boolean {
    return history.future.length > 0;
}

/** Steps back one change. Returns the same history when there is nothing to undo. */
export function undo(history: History): History {
    const previous = history.past[history.past.length - 1];
    if (!previous) return history;
    return {
        past: history.past.slice(0, -1),
        present: previous,
        future: [history.present, ...history.future],
    };
}

/** Re-applies the last undone change. Returns the same history when there is nothing to redo. */
export function redo(history: History): History {
    const [next, ...future] = history.future;
    if (!next) return history;
    return { past: [...history.past, history.present], present: next, future };
}
