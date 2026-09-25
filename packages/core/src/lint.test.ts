import { describe, expect, it } from 'vitest';
import { contrastRatio, GMAIL_CLIP_BYTES, lint } from './lint';
import {
    createButtonBlock,
    createEmptyDocument,
    createImageBlock,
    createRow,
    createTextBlock,
    type Block,
    type EmailDocument,
} from './model';

function documentWith(...blocks: Block[]): EmailDocument {
    const doc = createEmptyDocument();
    const row = createRow();
    row.columns[0]!.blocks.push(...blocks);
    doc.rows.push(row);
    return doc;
}

const rules = (doc: EmailDocument) => lint(doc).map((issue) => issue.rule);

describe('lint()', () => {
    it('has nothing to say about a plain email', () => {
        const doc = documentWith(
            createTextBlock('<p>Hello <a href="https://example.com">there</a></p>'),
            createButtonBlock('Shop', 'https://example.com/shop'),
            createImageBlock('https://example.com/a.png', 'A photo'),
        );
        expect(lint(doc)).toEqual([]);
    });

    it('names the block each issue is about', () => {
        const image = createImageBlock('https://example.com/a.png', '');
        const [issue] = lint(documentWith(image));
        expect(issue).toMatchObject({
            subject: { type: 'block', id: image.id },
            rule: 'image-alt',
            severity: 'warning',
        });
        expect(issue!.hint).toMatch(/screen readers/);
    });
});

describe('links', () => {
    it('refuses relative, script and empty links, in text, buttons and images', () => {
        const image = createImageBlock('https://example.com/a.png', 'A photo');
        image.href = '/sale';
        const doc = documentWith(
            createTextBlock(`<p><a href="javascript:alert(1)">x</a> <a href=''>y</a></p>`),
            createButtonBlock('Shop', 'shop.html'),
            image,
        );
        const issues = lint(doc);
        expect(issues.map((issue) => [issue.rule, issue.severity])).toEqual([
            ['link-invalid', 'error'],
            ['link-invalid', 'error'],
            ['link-invalid', 'error'],
            ['link-invalid', 'error'],
        ]);
        expect(issues[0]!.message).toBe(
            'A link in this text will not work: "javascript:alert(1)".',
        );
        expect(issues[1]!.message).toContain('"(empty)"');
    });

    it('accepts email and phone links, and the merge tags of sending services', () => {
        const doc = documentWith(
            createTextBlock(
                '<p><a href="mailto:hi@example.com">a</a> <a href="tel:+201000000000">b</a> ' +
                    '<a href="{{unsubscribe_url}}">c</a> <a href="*|UNSUB|*">d</a> ' +
                    '<a href="https://example.com/?a=1&amp;b=2">e</a></p>',
            ),
            createButtonBlock('Unsubscribe', '{% unsubscribe %}'),
        );
        expect(lint(doc)).toEqual([]);
    });

    it('asks for a link on a button that has none', () => {
        const [issue] = lint(documentWith(createButtonBlock('Shop', '  ')));
        expect(issue).toMatchObject({ rule: 'link-missing', severity: 'warning' });
    });
});

describe('images', () => {
    it('says an image without a URL is left out, and does not ask for its alt text', () => {
        expect(rules(documentWith(createImageBlock('', '')))).toEqual(['image-src']);
    });

    it('asks for alt text', () => {
        expect(rules(documentWith(createImageBlock('https://example.com/a.png', ' ')))).toEqual([
            'image-alt',
        ]);
    });
});

describe('contrast', () => {
    it('measures WCAG contrast ratios', () => {
        expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
        expect(contrastRatio('#fff', '#ffffff')).toBe(1);
        expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
        expect(contrastRatio('red', '#ffffff')).toBeUndefined();
    });

    it('warns about text that is hard to read on its background', () => {
        const text = createTextBlock('<p>Faint</p>');
        text.styles.color = '#aaaaaa';
        const [issue] = lint(documentWith(text));
        expect(issue).toMatchObject({ rule: 'contrast', severity: 'warning' });
        expect(issue!.message).toBe('The text is hard to read: contrast 2.3:1, below 4.5:1.');
    });

    it('uses the row background when the row has one', () => {
        const doc = documentWith(createTextBlock('<p>Dark on dark</p>'));
        doc.rows[0]!.styles.backgroundColor = '#111111';
        expect(rules(doc)).toEqual(['contrast']);
    });

    it('lets large text do with 3:1', () => {
        const text = createTextBlock('<p>Big</p>');
        text.styles.color = '#888888'; // 3.5:1 on white
        expect(rules(documentWith(text))).toEqual(['contrast']);
        text.styles.fontSize = 24;
        expect(rules(documentWith(text))).toEqual([]);
    });

    it('checks a button label against the button', () => {
        const button = createButtonBlock('Shop', 'https://example.com');
        button.styles.backgroundColor = '#dddddd';
        expect(rules(documentWith(button))).toEqual(['contrast']);
    });

    it('skips colours it cannot read', () => {
        const text = createTextBlock('<p>Named</p>');
        text.styles.color = 'white';
        expect(lint(documentWith(text))).toEqual([]);
    });
});

describe('contrast in dark mode', () => {
    it('only checks dark mode when the email has dark colours', () => {
        const doc = documentWith(createTextBlock('<p>Hello</p>'));
        expect(lint(doc)).toEqual([]);

        doc.styles.darkContentBackgroundColor = '#111111';
        const issues = lint(doc);
        expect(issues.map((issue) => issue.rule)).toEqual(['dark-contrast']);
        expect(issues[0]!.message).toMatch(/^In dark mode the text is hard to read/);
    });

    it('is happy once the text has a dark colour of its own', () => {
        const text = createTextBlock('<p>Hello</p>');
        text.styles.darkColor = '#f9fafb';
        const doc = documentWith(text);
        doc.styles.darkContentBackgroundColor = '#111111';
        expect(lint(doc)).toEqual([]);
    });

    it('keeps a row light in dark mode when only its light background is set', () => {
        const doc = documentWith(createTextBlock('<p>Hello</p>'));
        doc.styles.darkContentBackgroundColor = '#111111';
        doc.rows[0]!.styles.backgroundColor = '#ffffff';
        expect(lint(doc)).toEqual([]);
    });

    it('checks buttons with their dark colours', () => {
        const button = createButtonBlock('Shop', 'https://example.com');
        button.styles.darkBackgroundColor = '#ffffff';
        expect(rules(documentWith(button))).toEqual(['dark-contrast']);
    });
});

describe('Gmail clipping', () => {
    /** An email whose text alone is `bytes` long; the rest of the export adds a few KB. */
    function documentWithText(text: string) {
        return documentWith(createTextBlock(`<p>${text}</p>`));
    }

    it('warns as the email gets close to 102 KB and errs past it', () => {
        expect(rules(documentWithText('x'.repeat(80 * 1024)))).toEqual([]);

        const close = lint(documentWithText('x'.repeat(95 * 1024)));
        expect(close.map((issue) => [issue.rule, issue.severity])).toEqual([
            ['gmail-clipping', 'warning'],
        ]);
        expect(close[0]!.subject).toEqual({ type: 'document' });

        const over = lint(documentWithText('x'.repeat(GMAIL_CLIP_BYTES)));
        expect(over.map((issue) => [issue.rule, issue.severity])).toEqual([
            ['gmail-clipping', 'error'],
        ]);
        expect(over[0]!.message).toMatch(/^Gmail will clip this email: it is \d+ KB/);
    });

    it('counts bytes, not characters', () => {
        // 53K Arabic letters are 106 KB in UTF-8, twice as many bytes as characters.
        const issues = lint(documentWithText('ب'.repeat(53 * 1024)));
        expect(issues.map((issue) => [issue.rule, issue.severity])).toEqual([
            ['gmail-clipping', 'error'],
        ]);
    });
});
