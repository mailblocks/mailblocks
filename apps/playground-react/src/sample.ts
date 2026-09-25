import {
    createButtonBlock,
    createDividerBlock,
    createEmptyDocument,
    createImageBlock,
    createRow,
    createSpacerBlock,
    createTextBlock,
    type EmailDocument,
    type TextBlock,
} from '@mailblocks/core';

/** A text block with the given size, colour and alignment. */
function text(
    html: string,
    fontSize: number,
    color: string,
    align: TextBlock['styles']['textAlign'],
) {
    const block = createTextBlock(html);
    Object.assign(block.styles, { fontSize, color, textAlign: align });
    return block;
}

/** The email the demo opens with: a short tour of what the editor does. */
export function sampleDocument(): EmailDocument {
    const doc = createEmptyDocument();
    doc.styles.backgroundColor = '#eef2f7';

    // A WebP logo, on purpose: Outlook on Windows does not show WebP images,
    // so the demo opens with a compatibility marker to click.
    const header = createRow();
    header.styles.backgroundColor = '#1e3a8a';
    const logo = createImageBlock(new URL('logo.webp', document.baseURI).href, 'mailblocks');
    logo.width = 240;
    Object.assign(logo.styles, { paddingTop: 0, paddingBottom: 0 });
    header.columns[0]!.blocks.push(logo);

    const hero = createRow();
    Object.assign(hero.styles, { paddingTop: 24, paddingBottom: 8 });
    const button = createButtonBlock('Star on GitHub', 'https://github.com/mailblocks/mailblocks');
    button.styles.borderRadius = 6;
    hero.columns[0]!.blocks.push(
        text('<p><strong>Design once. Know where it breaks.</strong></p>', 28, '#111827', 'center'),
        text(
            '<p>Every block is checked against <a href="https://www.caniemail.com">Can I Email</a> ' +
                'data for the clients you target. Click any text to edit it, and select words to make ' +
                'them bold or a link.</p>',
            16,
            '#374151',
            'center',
        ),
        button,
        text(
            '<p>See the red marker on the logo? It is a WebP image, which Outlook on Windows ' +
                'does not show. Click the marker to see why, or open the Clients tab to see how ' +
                'this email does in every client.</p>',
            13,
            '#6b7280',
            'center',
        ),
        createDividerBlock(),
    );

    const features = createRow(2);
    Object.assign(features.styles, { paddingTop: 8, paddingBottom: 8 });
    features.columns[0]!.blocks.push(
        text(
            '<p><strong>Mobile ready</strong></p><p>Columns stack on phones, even where media queries are stripped. Try the Mobile switch.</p>',
            15,
            '#374151',
            'left',
        ),
    );
    features.columns[1]!.blocks.push(
        text(
            '<p><strong>Dark mode</strong></p><p>Give any colour a dark counterpart in the inspector, then preview it with the Dark switch.</p>',
            15,
            '#374151',
            'left',
        ),
    );

    const footer = createRow();
    Object.assign(footer.styles, { paddingTop: 8, paddingBottom: 24 });
    footer.columns[0]!.blocks.push(
        createSpacerBlock(8),
        text('<p>Open source, MIT licensed.</p>', 12, '#6b7280', 'center'),
    );

    doc.rows.push(header, hero, features, footer);
    return doc;
}
