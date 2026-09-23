import { describe, expect, it } from 'vitest';
import { canRedo, canUndo, createHistory, recordChange, redo, undo } from './history';
import { createEmptyDocument, type EmailDocument } from './model';

/** Distinct documents that are easy to tell apart in assertions. */
function docs(count: number): EmailDocument[] {
    return Array.from({ length: count }, () => createEmptyDocument());
}

describe('history', () => {
    it('starts with nothing to undo or redo', () => {
        const [a] = docs(1) as [EmailDocument];
        const history = createHistory(a);
        expect(history.present).toBe(a);
        expect(canUndo(history)).toBe(false);
        expect(canRedo(history)).toBe(false);
    });

    it('undoes and redoes changes in order', () => {
        const [a, b, c] = docs(3) as [EmailDocument, EmailDocument, EmailDocument];
        let history = recordChange(recordChange(createHistory(a), b), c);

        history = undo(history);
        expect(history.present).toBe(b);
        history = undo(history);
        expect(history.present).toBe(a);
        expect(canUndo(history)).toBe(false);

        history = redo(history);
        expect(history.present).toBe(b);
        history = redo(history);
        expect(history.present).toBe(c);
        expect(canRedo(history)).toBe(false);
    });

    it('drops the redo stack when a new change is recorded', () => {
        const [a, b, c] = docs(3) as [EmailDocument, EmailDocument, EmailDocument];
        const history = recordChange(undo(recordChange(createHistory(a), b)), c);
        expect(history.present).toBe(c);
        expect(canRedo(history)).toBe(false);
        expect(undo(history).present).toBe(a);
    });

    it('returns the same history when there is nothing to do', () => {
        const [a] = docs(1) as [EmailDocument];
        const history = createHistory(a);
        expect(undo(history)).toBe(history);
        expect(redo(history)).toBe(history);
        expect(recordChange(history, a)).toBe(history);
    });

    it('merges changes with the same key inside the merge window', () => {
        const [a, b, c, d] = docs(4) as [
            EmailDocument,
            EmailDocument,
            EmailDocument,
            EmailDocument,
        ];
        let history = createHistory(a);
        history = recordChange(history, b, { key: 'text:1', now: 0 });
        history = recordChange(history, c, { key: 'text:1', now: 500 });
        history = recordChange(history, d, { key: 'text:1', now: 900 });

        expect(history.present).toBe(d);
        expect(undo(history).present).toBe(a);
    });

    it('does not merge across keys, after the window, or without a key', () => {
        const [a, b, c, d, e] = docs(5) as [
            EmailDocument,
            EmailDocument,
            EmailDocument,
            EmailDocument,
            EmailDocument,
        ];
        let history = createHistory(a);
        history = recordChange(history, b, { key: 'text:1', now: 0 });
        history = recordChange(history, c, { key: 'text:2', now: 100 });
        history = recordChange(history, d, { key: 'text:2', now: 5000 });
        history = recordChange(history, e, { now: 5100 });

        expect(history.past).toEqual([a, b, c, d]);
    });

    it('starts a new step after an undo even with the same key', () => {
        const [a, b, c] = docs(3) as [EmailDocument, EmailDocument, EmailDocument];
        let history = recordChange(createHistory(a), b, { key: 'k', now: 0 });
        history = undo(history);
        history = recordChange(history, c, { key: 'k', now: 10 });
        expect(undo(history).present).toBe(a);
    });

    it('keeps at most `limit` undo steps', () => {
        const all = docs(6);
        let history = createHistory(all[0]!);
        for (const doc of all.slice(1)) history = recordChange(history, doc, { limit: 3 });
        expect(history.past).toEqual(all.slice(2, 5));
    });
});
