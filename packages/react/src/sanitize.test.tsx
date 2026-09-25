import { describe, expect, it } from 'vitest';
import {
    cleanPastedHtml,
    cleanTextHtml,
    isSafeHref,
    plainTextToHtml,
    tidyEditable,
} from './sanitize';

describe('cleanPastedHtml()', () => {
    it('keeps a single line inline, so it joins the line the caret is on', () => {
        expect(cleanPastedHtml('<span style="color:red;font-size:30px">Hello there</span>')).toBe(
            'Hello there',
        );
    });

    it('keeps the spaces at the ends of a piece of a line, but not of a paragraph', () => {
        expect(cleanPastedHtml('<span style="color:red"> from Docs </span>')).toBe(' from Docs ');
        expect(cleanPastedHtml('<p> from Docs </p>')).toBe('from Docs');
    });

    it('turns block elements into paragraphs', () => {
        expect(cleanPastedHtml('<div>One</div><div>Two<br>still two</div><p>Three</p>')).toBe(
            '<p>One</p><p>Two<br>still two</p><p>Three</p>',
        );
    });

    it('keeps bold, italic, underline and links, however they were written', () => {
        expect(
            cleanPastedHtml(
                '<p><b>a</b> <strong>b</strong> <span style="font-weight:700">c</span> ' +
                    '<i>d</i> <span style="font-style: italic">e</span> <u>f</u> ' +
                    '<a href="https://example.com" style="color:blue" target="_blank">g</a></p>',
            ),
        ).toBe(
            '<strong>a</strong> <strong>b</strong> <strong>c</strong> <em>d</em> <em>e</em> ' +
                '<u>f</u> <a href="https://example.com">g</a>',
        );
    });

    it('reads Google Docs, which wraps everything in a bold tag that is not bold', () => {
        const docs =
            '<meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-1234">' +
            '<p dir="ltr" style="line-height:1.38"><span style="font-size:11pt;font-family:Arial;' +
            'font-weight:400">Plain and </span><span style="font-size:11pt;font-weight:700">bold</span></p>' +
            '<p dir="ltr"><span style="font-style:italic">slanted</span></p></b>';
        expect(cleanPastedHtml(docs)).toBe(
            '<p>Plain and <strong>bold</strong></p><p><em>slanted</em></p>',
        );
    });

    it('reads Word, dropping its classes, comments, o:p elements and trailing spaces', () => {
        const word =
            '<html xmlns:o="urn:schemas-microsoft-com:office:office"><head><style>p.MsoNormal{margin:0}</style></head>' +
            '<body><!--StartFragment--><p class="MsoNormal">First <b>line</b><o:p></o:p></p>' +
            '<p class="MsoNormal"><span lang="AR-EG" dir="rtl">سطر تاني</span><o:p>&nbsp;</o:p></p>' +
            '<!--EndFragment--></body></html>';
        expect(cleanPastedHtml(word)).toBe('<p>First <strong>line</strong></p><p>سطر تاني</p>');
    });

    it('drops scripts, styles, images, embeds and form fields with what is inside them', () => {
        expect(
            cleanPastedHtml(
                '<p>Keep<script>alert(1)</script><style>p{}</style><img src="x" onerror="alert(1)">' +
                    '<iframe src="https://example.com"></iframe><button>No</button> this</p>',
            ),
        ).toBe('Keep this');
    });

    it('keeps the text of unsafe links but not the link', () => {
        expect(
            cleanPastedHtml(
                '<a href="javascript:alert(1)">one</a> <a href="/relative">two</a> ' +
                    '<a href="{{unsubscribe_url}}">three</a> <a href="mailto:hi@example.com">four</a>',
            ),
        ).toBe(
            'one two <a href="{{unsubscribe_url}}">three</a> <a href="mailto:hi@example.com">four</a>',
        );
    });

    it('turns headings into bold paragraphs and list items into marked ones', () => {
        expect(
            cleanPastedHtml(
                '<h2>Title</h2><ul><li>Apples</li><li>Pears</li></ul><ol start="3"><li>Third</li><li>Fourth</li></ol>',
            ),
        ).toBe(
            '<p><strong>Title</strong></p><p>• Apples</p><p>• Pears</p><p>3. Third</p><p>4. Fourth</p>',
        );
    });

    it('flattens tables into a paragraph per row', () => {
        expect(
            cleanPastedHtml('<table><tr><td>a</td><td>b</td></tr><tr><td>c</td></tr></table>'),
        ).toBe('<p>ab</p><p>c</p>');
    });

    it('escapes text that looks like markup', () => {
        expect(cleanPastedHtml('<p>1 &lt; 2 &amp;&amp; &lt;b&gt;</p>')).toBe(
            '1 &lt; 2 &amp;&amp; &lt;b&gt;',
        );
    });

    it('collapses whitespace from the source, and drops empty paragraphs and tags', () => {
        expect(
            cleanPastedHtml('<p>\n  Hello\n   world  </p><p> </p><p><b></b></p><p>End</p>'),
        ).toBe('<p>Hello world</p><p>End</p>');
    });

    it('does not leave two spaces where something was dropped', () => {
        expect(cleanPastedHtml('<p>before <img src="x"> after</p>')).toBe('before after');
    });

    it('does not nest the same format twice', () => {
        expect(
            cleanPastedHtml('<b>a <strong>b <span style="font-weight:bold">c</span></strong></b>'),
        ).toBe('<strong>a b c</strong>');
    });
});

describe('plainTextToHtml()', () => {
    it('makes paragraphs of blank-line separated text and keeps single line breaks', () => {
        expect(plainTextToHtml('First line\nsame paragraph\r\n\r\nSecond <one> & more\n')).toBe(
            '<p>First line<br>same paragraph</p><p>Second &lt;one&gt; &amp; more</p>',
        );
    });

    it('keeps a piece of a line as it is, spaces at its ends included', () => {
        expect(plainTextToHtml(' just <this> ')).toBe(' just &lt;this&gt; ');
    });

    it('returns a single paragraph inline', () => {
        expect(plainTextToHtml('one\ntwo\n')).toBe('one<br>two');
    });
});

describe('isSafeHref()', () => {
    it('accepts web, email and phone links and merge tags only', () => {
        expect(isSafeHref('https://example.com')).toBe(true);
        expect(isSafeHref(' mailto:hi@example.com ')).toBe(true);
        expect(isSafeHref('tel:+20100')).toBe(true);
        expect(isSafeHref('*|UNSUB|*')).toBe(true);
        expect(isSafeHref('javascript:alert(1)')).toBe(false);
        expect(isSafeHref('//example.com')).toBe(false);
        expect(isSafeHref('')).toBe(false);
    });
});

describe('tidyEditable()', () => {
    function editable(html: string) {
        const root = document.createElement('div');
        root.contentEditable = 'true';
        root.innerHTML = html;
        document.body.append(root);
        return root;
    }

    it('leaves clean text alone and says so', () => {
        const root = editable('<p>Hi <b>there</b> <a href="https://example.com">x</a></p>');
        expect(tidyEditable(root)).toBe(false);
        expect(root.innerHTML).toBe('<p>Hi <b>there</b> <a href="https://example.com">x</a></p>');
    });

    it('unwraps the styled spans browsers add and strips attributes', () => {
        const root = editable(
            '<p style="margin:0">One <span style="font-size:16px">joined</span> <b class="x">two</b></p>',
        );
        expect(tidyEditable(root)).toBe(true);
        expect(root.innerHTML).toBe('<p>One joined <b>two</b></p>');
    });

    it('drops images and scripts, turns top-level divs into paragraphs and unlinks unsafe links', () => {
        const root = editable(
            '<p>a<img src="x"></p><div>b <a href="javascript:x" target="_blank">c</a></div><script>1</script>',
        );
        tidyEditable(root);
        expect(root.innerHTML).toBe('<p>a</p><p>b c</p>');
    });

    it('keeps the caret in the same place', () => {
        const root = editable('<p>One <span style="color:red">two</span></p>');
        const text = root.querySelector('span')!.firstChild!;
        document.getSelection()!.collapse(text, 2);

        tidyEditable(root);
        const selection = document.getSelection()!;
        expect(selection.anchorNode).toBe(text);
        expect(selection.anchorOffset).toBe(2);
    });
});

describe('cleanTextHtml()', () => {
    it('keeps the paragraphs and formats of a text block', () => {
        expect(
            cleanTextHtml(
                '<p>Hi <b>there</b><br>again</p><p><a href="https://example.com">x</a></p>',
            ),
        ).toBe('<p>Hi <b>there</b><br>again</p><p><a href="https://example.com">x</a></p>');
    });

    it('removes what could run, load or restyle', () => {
        expect(
            cleanTextHtml(
                '<p onclick="alert(1)">Hi<img src="x" onerror="alert(1)"><script>alert(1)</script>' +
                    '<a href="javascript:alert(1)">link</a><span style="color:red">red</span></p>' +
                    '<div>next</div><style>p{display:none}</style>',
            ),
        ).toBe('<p>Hilinkred</p><p>next</p>');
    });
});
