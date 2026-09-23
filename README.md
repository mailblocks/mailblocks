# mailblocks

An email builder that knows which email clients will break your design.

Most email builders let you drag blocks around and then leave you to discover in Outlook that
half of it does not render. mailblocks checks every style in the document against
[Can I Email](https://www.caniemail.com) data for the clients you care about, tells you what is
not supported and why, and exports table-based HTML that those clients can actually render.

> **Status:** early development. The core library works and is tested; there is no visual editor
> yet and nothing is published to npm. APIs will change until 1.0.

## What works today

- **Document model** – rows, columns and blocks, with a text block as the first block type.
- **Compatibility check** – `check(doc, targets)` returns a warning for every style a target
  client does not fully support, with Can I Email's footnotes explaining what exactly is missing.
- **HTML export** – `exportHtml(doc)` renders nested tables with inline styles, pixel units and
  the Outlook-specific hints that keep it from mangling the result.
- **Playground** – a local page to edit a document as JSON and see the export and the warnings
  update live.

```ts
import {
    check,
    createEmptyDocument,
    createRow,
    createTextBlock,
    exportHtml,
} from '@mailblocks/core';

const doc = createEmptyDocument();
const row = createRow(2);
row.columns[0].blocks.push(createTextBlock('<p>Left column</p>'));
row.columns[1].blocks.push(createTextBlock('<p>Right column</p>'));
doc.rows.push(row);

check(doc, [
    { family: 'gmail', platform: 'desktop-webmail' },
    { family: 'outlook', platform: 'windows' },
]);
// [{ property: 'lineHeight', feature: 'css-line-height', level: 'a',
//    target: { family: 'outlook', platform: 'windows' },
//    notes: ['Buggy. `em` and `px` units behave weirdly. Use `mso-line-height-rule:exactly`.'], ... }]

exportHtml(doc);
// '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" ...'
```

## Try it

```sh
git clone https://github.com/mailblocks/mailblocks.git
cd mailblocks
pnpm install
pnpm dev          # playground on http://localhost:5173
pnpm test
```

Requires Node 22 and pnpm 11.

## Client support data

Support levels come from [Can I Email](https://www.caniemail.com) by Rémi Parmentier, used under
the MIT license (see [`packages/core/data/LICENSE-caniemail`](./packages/core/data/LICENSE-caniemail)). A copy of its API
data lives in `packages/core/data/caniemail.json`; `pnpm data:build` turns it into the compact table the
library uses, keeping only the latest tested version of each client. Update the JSON and rerun
the script to pick up new data.

## Roadmap

1. More block types: image, button, divider, spacer.
2. Value-aware warnings, so a `text-align: center` is not flagged for a note about `start`.
3. The visual editor, as framework packages on top of this core.

## Contributing

Pull requests are welcome. Open an issue first for anything bigger than a fix so we can agree on
the approach. Every PR runs formatting, typechecking and the test suite; PR titles follow
[Conventional Commits](https://www.conventionalcommits.org/) because they become the squash commit
on `main`.

## License

[MIT](./LICENSE) © Ibrahim Mohamed
