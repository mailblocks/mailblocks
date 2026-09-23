# mailblocks

An email builder that knows which email clients will break your design.

Most email builders let you drag blocks around and then leave you to discover in Outlook that
half of it does not render. mailblocks checks every style in the document against
[Can I Email](https://www.caniemail.com) data for the clients you care about, tells you what is
not supported and why, and exports table-based HTML that those clients can actually render.

> **Status:** early development. The core library and a first React editor work and are tested;
> nothing is published to npm yet. APIs will change until 1.0.

## What works today

- **Document model** – rows, columns and blocks: text, image, button, divider and spacer.
- **Compatibility check** – `check(doc, targets)` returns a warning for every style of the
  email, its rows and its blocks that a target client does not fully support, with Can I Email's
  footnotes explaining what exactly is missing. Footnotes about values the export never writes
  (a `start` alignment, `rem` sizes) or problems it already works around (padding outside table
  cells) are left out, and a partial support with nothing left is not reported. Image formats are
  checked too, so a `.webp` or `.svg` warns for clients that cannot show it.
- **HTML export** – `exportHtml(doc)` renders nested tables with inline styles, pixel units and
  the Outlook-specific hints that keep it from mangling the result: buttons whose colour and
  padding sit on a table cell (and rounded ones redrawn in VML for Outlook on Windows), dividers
  drawn as table borders, spacers sized with cell heights.
- **React editor** – `<MailBlocks>` lets you type into text blocks in place, add any block type,
  style the selected block in an inspector that lists its warnings, and move blocks up and down.
  Select a row to change its column layout, background, padding and order; select nothing to set
  the email background, content width and font. Every change can be undone and redone.

Neither package has runtime dependencies beyond React for the editor.

## Packages

| Package                                 | What                                                          |
| --------------------------------------- | ------------------------------------------------------------- |
| [`@mailblocks/core`](./packages/core)   | Document model, operations, undo history, checks, HTML export |
| [`@mailblocks/react`](./packages/react) | The `<MailBlocks>` editor component                           |

## Using the core

```ts
import {
    check,
    createButtonBlock,
    createEmptyDocument,
    createImageBlock,
    createRow,
    createTextBlock,
    exportHtml,
} from '@mailblocks/core';

const doc = createEmptyDocument();
const row = createRow(2);
row.columns[0].blocks.push(createTextBlock('<p>Left column</p>'));
row.columns[1].blocks.push(createButtonBlock('Shop now', 'https://example.com'));
row.columns[1].blocks.push(createImageBlock('https://example.com/hero.webp', 'Summer sale'));
doc.rows.push(row);

check(doc, [
    { family: 'gmail', platform: 'desktop-webmail' },
    { family: 'outlook', platform: 'windows' },
]);
// [{ subject: { type: 'block', id: '…' }, property: 'src', feature: 'image-webp', level: 'a',
//    target: { family: 'gmail', platform: 'desktop-webmail' },
//    notes: ['Partial: Converts file to jpg.', 'Partial. Does not support animation.'], ... },
//  { subject: { type: 'block', id: '…' }, property: 'src', feature: 'image-webp', level: 'n',
//    target: { family: 'outlook', platform: 'windows' }, notes: [], ... }]
// The button's rounded corners are not reported: the export draws them in VML for Outlook.

exportHtml(doc);
// '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" ...'
```

## Using the React editor

```tsx
import { createEmptyDocument, exportHtml } from '@mailblocks/core';
import { MailBlocks } from '@mailblocks/react';
import '@mailblocks/react/styles.css';
import { useState } from 'react';

export function Designer() {
    const [doc, setDoc] = useState(createEmptyDocument);
    return (
        <MailBlocks
            document={doc}
            onChange={setDoc}
            targets={[
                { family: 'gmail', platform: 'desktop-webmail' },
                { family: 'outlook', platform: 'windows' },
            ]}
        />
    );
}

// Whenever you need the email: exportHtml(doc)
```

The component is controlled: it never changes `document`, it calls `onChange` with a new one.
Undo history lives inside it and starts over when you pass a document it did not produce.

## Try it

```sh
git clone https://github.com/mailblocks/mailblocks.git
cd mailblocks
pnpm install
pnpm dev:react    # React editor on http://localhost:5174
pnpm dev          # core playground (document as JSON) on http://localhost:5173
pnpm test
```

Requires Node 22 and pnpm 11.

## Client support data

Support levels come from [Can I Email](https://www.caniemail.com) by Rémi Parmentier, used under
the MIT license (see
[`packages/core/data/LICENSE-caniemail`](./packages/core/data/LICENSE-caniemail)). A copy of its
API data lives in `packages/core/data/caniemail.json`; `pnpm data:build` turns it into the compact
table the library uses, keeping only the latest tested version of each client. Update the JSON
and rerun the script to pick up new data.

## Roadmap

1. An Angular package on top of the same core.
2. A first release on npm.

## Contributing

Pull requests are welcome. Open an issue first for anything bigger than a fix so we can agree on
the approach. Every PR runs formatting, typechecking and the test suite; PR titles follow
[Conventional Commits](https://www.conventionalcommits.org/) because they become the squash commit
on `main`.

## License

[MIT](./LICENSE) © Ibrahim Mohamed
