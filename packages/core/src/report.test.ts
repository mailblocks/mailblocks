import { describe, expect, it } from 'vitest';
import { allTargets, clientReport, targetName } from './report';
import {
    createEmptyDocument,
    createImageBlock,
    createRow,
    createTextBlock,
    type EmailDocument,
} from './model';

function withImage(src: string): EmailDocument {
    const doc = createEmptyDocument();
    const row = createRow();
    row.columns[0]?.blocks.push(createImageBlock(src, ''));
    doc.rows.push(row);
    return doc;
}

describe('allTargets()', () => {
    it('lists every client once, sorted by name', () => {
        const targets = allTargets();
        const keys = targets.map((t) => `${t.family}/${t.platform}`);

        expect(keys).toContain('gmail/desktop-webmail');
        expect(keys).toContain('outlook/windows');
        expect(new Set(keys).size).toBe(keys.length);
        const names = targets.map(targetName);
        expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    });

    it('returns a copy callers can change', () => {
        allTargets().pop();
        expect(allTargets().length).toBeGreaterThan(40);
    });
});

describe('targetName()', () => {
    it('joins the family and platform names from Can I Email', () => {
        expect(targetName({ family: 'apple-mail', platform: 'ios' })).toBe('Apple Mail iOS');
        expect(targetName({ family: 'gmail', platform: 'desktop-webmail' })).toBe(
            'Gmail Desktop Webmail',
        );
    });

    it('does not repeat the family when the platform already names it', () => {
        expect(targetName({ family: 'outlook', platform: 'outlook-com' })).toBe('Outlook.com');
    });
});

describe('clientReport()', () => {
    it('rates each client by its worst warning', () => {
        const report = clientReport(withImage('https://example.com/a.webp'), [
            { family: 'outlook', platform: 'windows' },
            { family: 'gmail', platform: 'desktop-webmail' },
            { family: 'apple-mail', platform: 'ios' },
        ]);

        expect(report.map((r) => [r.name, r.status])).toEqual([
            ['Outlook Windows', 'unsupported'],
            ['Gmail Desktop Webmail', 'partial'],
            ['Apple Mail iOS', 'ok'],
        ]);
        expect(report[0]?.warnings.map((w) => w.feature)).toEqual(['image-webp']);
        expect(report[2]?.warnings).toEqual([]);
    });

    it('reports unknown support separately from problems', () => {
        const doc = createEmptyDocument();
        const row = createRow();
        row.columns[0]?.blocks.push(createTextBlock('<p>Hello</p>'));
        doc.rows.push(row);

        // Can I Email has no data on font-size for SFR, and nothing else is a problem there.
        const [sfr] = clientReport(doc, [{ family: 'sfr', platform: 'desktop-webmail' }]);
        expect(sfr?.status).toBe('unknown');
        expect(sfr?.warnings.map((w) => w.level)).toEqual(['u']);
    });

    it('covers every client by default', () => {
        expect(clientReport(createEmptyDocument())).toHaveLength(allTargets().length);
    });
});
