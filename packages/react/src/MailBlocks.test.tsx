import {
    createButtonBlock,
    createEmptyDocument,
    createImageBlock,
    createRow,
    createSpacerBlock,
    createTextBlock,
    findBlock,
    type Block,
    type ButtonBlock,
    type EmailDocument,
    type TextBlock,
} from '@mailblocks/core';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { MailBlocks } from './MailBlocks';

/** Keeps the document in state so the UI reflects edits, like a real host would. */
function Harness({
    initial,
    onChange,
}: {
    initial: EmailDocument;
    onChange?: (doc: EmailDocument) => void;
}) {
    const [doc, setDoc] = useState(initial);
    return (
        <MailBlocks
            document={doc}
            onChange={(next) => {
                setDoc(next);
                onChange?.(next);
            }}
        />
    );
}

/** Picks a block type from the "Add block" menu of the given column. */
function addFromMenu(type: string, column = 0) {
    fireEvent.change(screen.getAllByLabelText('Add block')[column]!, { target: { value: type } });
}

function documentWith(...blocks: Block[]): EmailDocument {
    const doc = createEmptyDocument();
    const row = createRow();
    row.columns[0]?.blocks.push(...blocks);
    doc.rows.push(row);
    return doc;
}

describe('<MailBlocks />', () => {
    it('renders the blocks and shows the inspector once one is selected', async () => {
        const doc = documentWith(createTextBlock('<p>Hello</p>'));
        render(<MailBlocks document={doc} onChange={vi.fn()} />);

        expect(screen.getByText('Click a row or a block to edit it.')).toBeTruthy();
        await userEvent.click(screen.getByText('Hello'));
        expect(screen.getByLabelText('Font size')).toBeTruthy();
    });

    it('updates a style through the inspector without mutating the document', async () => {
        const block = createTextBlock('<p>Hello</p>');
        const doc = documentWith(block);
        const onChange = vi.fn<(doc: EmailDocument) => void>();
        render(<MailBlocks document={doc} onChange={onChange} />);

        await userEvent.click(screen.getByText('Hello'));
        fireEvent.change(screen.getByLabelText('Font size'), { target: { value: '20' } });

        expect(onChange).toHaveBeenCalledTimes(1);
        const next = onChange.mock.calls[0]?.[0];
        expect(next && (findBlock(next, block.id)?.block as TextBlock).styles.fontSize).toBe(20);
        expect(block.styles.fontSize).toBe(16);
    });

    it('adds a text block to a column', async () => {
        const doc = documentWith(createTextBlock('<p>Hello</p>'));
        const onChange = vi.fn<(doc: EmailDocument) => void>();
        render(<MailBlocks document={doc} onChange={onChange} />);

        addFromMenu('text');

        const next = onChange.mock.calls[0]?.[0];
        expect(next?.rows[0]?.columns[0]?.blocks).toHaveLength(2);
    });

    it('shows compatibility warnings for the selected block', async () => {
        const doc = documentWith(createTextBlock('<p>Hello</p>'));
        render(
            <MailBlocks
                document={doc}
                onChange={vi.fn()}
                targets={[{ family: 'orange', platform: 'desktop-webmail' }]}
            />,
        );

        await userEvent.click(screen.getByText('Hello'));
        expect(screen.getAllByText('unknown').length).toBeGreaterThan(0);
        expect(screen.getByText('Font size', { selector: 'strong' })).toBeTruthy();
    });

    it('says so when the selected block is safe for every target', async () => {
        // Outlook's partial support for these styles is about values the export never writes.
        const doc = documentWith(createTextBlock('<p>Hello</p>'));
        render(
            <MailBlocks
                document={doc}
                onChange={vi.fn()}
                targets={[{ family: 'outlook', platform: 'windows' }]}
            />,
        );

        await userEvent.click(screen.getByText('Hello'));
        expect(screen.getByText('No warnings for the selected targets.')).toBeTruthy();
    });
});

describe('<MailBlocks /> with image blocks', () => {
    it('adds an image block and edits its URL in the inspector', async () => {
        const doc = documentWith(createTextBlock('<p>Hello</p>'));
        const onChange = vi.fn<(doc: EmailDocument) => void>();
        render(<Harness initial={doc} onChange={onChange} />);

        addFromMenu('image');

        const next = onChange.mock.calls[0]?.[0];
        const added = next?.rows[0]?.columns[0]?.blocks[1];
        expect(added?.type).toBe('image');
        expect(screen.getByLabelText('Image URL')).toBeTruthy();
    });

    it('warns about image formats for the selected image', async () => {
        const image = createImageBlock('https://example.com/a.webp', 'Photo');
        const doc = documentWith(image);
        render(
            <MailBlocks
                document={doc}
                onChange={vi.fn()}
                targets={[{ family: 'outlook', platform: 'windows' }]}
            />,
        );

        await userEvent.click(screen.getByAltText('Photo'));
        expect(screen.getByText('Image format')).toBeTruthy();
        expect(screen.getAllByText('not supported').length).toBeGreaterThan(0);
    });
});

describe('<MailBlocks /> undo and redo', () => {
    function fontSizeInput() {
        return screen.getByLabelText('Font size') as HTMLInputElement;
    }

    it('starts with nothing to undo', () => {
        render(<Harness initial={documentWith(createTextBlock('<p>Hello</p>'))} />);
        expect((screen.getByRole('button', { name: 'Undo' }) as HTMLButtonElement).disabled).toBe(
            true,
        );
        expect((screen.getByRole('button', { name: 'Redo' }) as HTMLButtonElement).disabled).toBe(
            true,
        );
    });

    it('undoes and redoes a style change from the toolbar', async () => {
        render(<Harness initial={documentWith(createTextBlock('<p>Hello</p>'))} />);
        await userEvent.click(screen.getByText('Hello'));
        fireEvent.change(fontSizeInput(), { target: { value: '20' } });
        expect(fontSizeInput().value).toBe('20');

        await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
        expect(fontSizeInput().value).toBe('16');

        await userEvent.click(screen.getByRole('button', { name: 'Redo' }));
        expect(fontSizeInput().value).toBe('20');
    });

    it('groups quick edits of the same field into one step', async () => {
        render(<Harness initial={documentWith(createTextBlock('<p>Hello</p>'))} />);
        await userEvent.click(screen.getByText('Hello'));
        fireEvent.change(fontSizeInput(), { target: { value: '2' } });
        fireEvent.change(fontSizeInput(), { target: { value: '24' } });

        await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
        expect(fontSizeInput().value).toBe('16');
    });

    it('brings back a removed block with Ctrl+Z and removes it again with Ctrl+Shift+Z', async () => {
        const { container } = render(
            <Harness initial={documentWith(createTextBlock('<p>Hello</p>'))} />,
        );
        const editor = container.querySelector('.mb-editor')!;
        await userEvent.click(screen.getByText('Hello'));
        await userEvent.click(screen.getByRole('button', { name: 'Remove block' }));
        expect(screen.queryByText('Hello')).toBeNull();

        fireEvent.keyDown(editor, { key: 'z', ctrlKey: true });
        expect(screen.getByText('Hello')).toBeTruthy();

        fireEvent.keyDown(editor, { key: 'Z', ctrlKey: true, shiftKey: true });
        expect(screen.queryByText('Hello')).toBeNull();
    });
});

describe('<MailBlocks /> reordering', () => {
    function texts(container: HTMLElement) {
        return [...container.querySelectorAll('.mb-block')].map((block) => block.textContent);
    }

    it('moves the selected block up and down inside its column', async () => {
        const { container } = render(
            <Harness
                initial={documentWith(
                    createTextBlock('<p>One</p>'),
                    createTextBlock('<p>Two</p>'),
                    createTextBlock('<p>Three</p>'),
                )}
            />,
        );

        await userEvent.click(screen.getByText('Two'));
        await userEvent.click(screen.getByRole('button', { name: 'Move up' }));
        expect(texts(container)).toEqual(['Two', 'One', 'Three']);

        await userEvent.click(screen.getByRole('button', { name: 'Move down' }));
        await userEvent.click(screen.getByRole('button', { name: 'Move down' }));
        expect(texts(container)).toEqual(['One', 'Three', 'Two']);
    });

    it('disables moves past the ends of the column', async () => {
        render(
            <Harness
                initial={documentWith(createTextBlock('<p>One</p>'), createTextBlock('<p>Two</p>'))}
            />,
        );
        const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;

        await userEvent.click(screen.getByText('One'));
        expect(button('Move up').disabled).toBe(true);
        expect(button('Move down').disabled).toBe(false);

        await userEvent.click(screen.getByText('Two'));
        expect(button('Move up').disabled).toBe(false);
        expect(button('Move down').disabled).toBe(true);
    });

    it('undoes a move in one step', async () => {
        const { container } = render(
            <Harness
                initial={documentWith(createTextBlock('<p>One</p>'), createTextBlock('<p>Two</p>'))}
            />,
        );

        await userEvent.click(screen.getByText('Two'));
        await userEvent.click(screen.getByRole('button', { name: 'Move up' }));
        await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
        expect(texts(container)).toEqual(['One', 'Two']);
    });
});

describe('<MailBlocks /> with button blocks', () => {
    it('adds a button and changes its label from the inspector', async () => {
        render(<Harness initial={documentWith(createTextBlock('<p>Hello</p>'))} />);

        addFromMenu('button');
        fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'Buy now' } });

        expect(screen.getByText('Buy now')).toBeTruthy();
    });

    it('warns about rounded corners for the selected button where they cannot be drawn', async () => {
        render(
            <MailBlocks
                document={documentWith(createButtonBlock('Shop'))}
                onChange={vi.fn()}
                targets={[
                    { family: 'outlook', platform: 'windows' },
                    { family: 'orange', platform: 'desktop-webmail' },
                ]}
            />,
        );

        await userEvent.click(screen.getByText('Shop'));
        // Orange cannot round the corners; Outlook on Windows gets the VML button.
        const warning = screen.getByText('Rounded corners', { selector: 'strong' }).closest('li');
        expect(warning?.textContent).toContain('Orange');
        expect(screen.getAllByText('Rounded corners', { selector: 'strong' })).toHaveLength(1);
    });
});

describe('<MailBlocks /> with divider and spacer blocks', () => {
    it('adds a divider and changes its line style', async () => {
        const { container } = render(
            <Harness initial={documentWith(createTextBlock('<p>Hello</p>'))} />,
        );

        addFromMenu('divider');
        await userEvent.click(screen.getByRole('radio', { name: 'Dashed' }));

        const line = container.querySelector('.mb-divider') as HTMLElement;
        expect(line.style.borderTop).toContain('dashed');
    });

    it('adds a spacer and changes its height', async () => {
        const { container } = render(
            <Harness initial={documentWith(createTextBlock('<p>Hello</p>'))} />,
        );

        addFromMenu('spacer');
        fireEvent.change(screen.getByLabelText('Height'), { target: { value: '40' } });

        const spacer = container.querySelector('.mb-spacer') as HTMLElement;
        expect(spacer.style.height).toBe('40px');
    });
});

describe('<MailBlocks /> email and row settings', () => {
    function twoRows() {
        const doc = documentWith(createTextBlock('<p>First</p>'));
        const second = createRow();
        second.columns[0]?.blocks.push(createTextBlock('<p>Second</p>'));
        doc.rows.push(second);
        return doc;
    }

    it('edits the email settings when nothing is selected', async () => {
        const { container } = render(<Harness initial={twoRows()} />);

        fireEvent.change(screen.getByLabelText('Content width'), { target: { value: '480' } });

        const content = container.querySelector('.mb-content') as HTMLElement;
        expect(content.style.width).toBe('480px');
    });

    it('selects a row by clicking it and changes its column layout', async () => {
        const { container } = render(<Harness initial={twoRows()} />);
        const firstRow = container.querySelector('.mb-row') as HTMLElement;

        await userEvent.click(firstRow);
        expect(screen.getByRole('heading', { name: 'Row' })).toBeTruthy();

        await userEvent.click(screen.getByRole('radio', { name: '3 columns' }));
        expect(firstRow.querySelectorAll('.mb-column')).toHaveLength(3);
        expect(screen.getByText('First')).toBeTruthy();
    });

    it('gives a row a background and takes it away again', async () => {
        const { container } = render(<Harness initial={twoRows()} />);
        const firstRow = container.querySelector('.mb-row') as HTMLElement;
        await userEvent.click(firstRow);

        await userEvent.click(screen.getByLabelText('Background'));
        fireEvent.change(screen.getByLabelText('Background color'), {
            target: { value: '#ff0000' },
        });
        expect(firstRow.style.backgroundColor).toBe('rgb(255, 0, 0)');

        await userEvent.click(screen.getByLabelText('Background'));
        expect(firstRow.style.backgroundColor).toBe('');
    });

    it('moves and removes rows', async () => {
        const { container } = render(<Harness initial={twoRows()} />);
        const texts = () =>
            [...container.querySelectorAll('.mb-row')].map((row) => row.textContent);

        await userEvent.click(container.querySelector('.mb-row') as HTMLElement);
        await userEvent.click(screen.getByRole('button', { name: 'Move row down' }));
        expect(texts()[0]).toContain('Second');

        await userEvent.click(screen.getByRole('button', { name: 'Remove row' }));
        expect(container.querySelectorAll('.mb-row')).toHaveLength(1);
        expect(screen.queryByText('First')).toBeNull();
    });

    it('selects a new row as soon as it is added', async () => {
        render(<Harness initial={twoRows()} />);
        await userEvent.click(screen.getByRole('button', { name: '+ 2-column row' }));
        expect(screen.getByRole('heading', { name: 'Row' })).toBeTruthy();
        expect(screen.getByRole('radio', { name: '2 columns' }).getAttribute('aria-checked')).toBe(
            'true',
        );
    });
});

describe('<MailBlocks /> warnings for rows and the email', () => {
    it("lists the selected row's own warnings", async () => {
        const doc = documentWith(createTextBlock('<p>Hello</p>'));
        doc.rows[0]!.styles.backgroundColor = '#ffffff';
        const { container } = render(
            <MailBlocks
                document={doc}
                onChange={vi.fn()}
                targets={[{ family: 'orange', platform: 'desktop-webmail' }]}
            />,
        );

        await userEvent.click(container.querySelector('.mb-row') as HTMLElement);
        expect(screen.getByText('Background color', { selector: 'strong' })).toBeTruthy();
        expect(screen.getByText(/color keywords/)).toBeTruthy();
    });

    it("lists the email's warnings when nothing is selected", () => {
        render(
            <MailBlocks
                document={createEmptyDocument()}
                onChange={vi.fn()}
                targets={[{ family: 'orange', platform: 'desktop-webmail' }]}
            />,
        );
        expect(screen.getByText('Background color', { selector: 'strong' })).toBeTruthy();
        expect(screen.getByText(/color keywords/)).toBeTruthy();
    });
});

describe('<MailBlocks /> add block menu', () => {
    it('offers one menu per column with every block type', () => {
        const doc = documentWith(createTextBlock('<p>Hello</p>'));
        doc.rows.push(createRow(2));
        render(<Harness initial={doc} />);

        const menus = screen.getAllByLabelText('Add block') as HTMLSelectElement[];
        expect(menus).toHaveLength(3);
        expect([...menus[0]!.options].map((option) => option.textContent)).toEqual([
            '+ Add block',
            'Text',
            'Image',
            'Button',
            'Divider',
            'Spacer',
        ]);
    });

    it('adds the chosen block to that column, selects it and resets the menu', () => {
        const doc = createEmptyDocument();
        doc.rows.push(createRow(2));
        const onChange = vi.fn<(doc: EmailDocument) => void>();
        render(<Harness initial={doc} onChange={onChange} />);

        addFromMenu('button', 1);

        const next = onChange.mock.calls[0]?.[0];
        expect(next?.rows[0]?.columns[0]?.blocks).toHaveLength(0);
        expect(next?.rows[0]?.columns[1]?.blocks[0]?.type).toBe('button');
        expect(screen.getByRole('heading', { name: 'Button' })).toBeTruthy();
        expect((screen.getAllByLabelText('Add block')[1] as HTMLSelectElement).value).toBe('');
    });

    it('does not select the row when the menu is clicked', async () => {
        render(<Harness initial={documentWith(createTextBlock('<p>Hello</p>'))} />);
        await userEvent.click(screen.getByLabelText('Add block'));
        expect(screen.getByRole('heading', { name: 'Email' })).toBeTruthy();
    });
});

describe('<MailBlocks /> icon choices', () => {
    it('aligns the selected text block with the icon buttons', async () => {
        const { container } = render(
            <Harness initial={documentWith(createTextBlock('<p>Hello</p>'))} />,
        );
        await userEvent.click(screen.getByText('Hello'));

        const left = screen.getByRole('radio', { name: 'Left' });
        expect(left.getAttribute('aria-checked')).toBe('true');
        await userEvent.click(screen.getByRole('radio', { name: 'Center' }));

        const block = container.querySelector('.mb-block') as HTMLElement;
        expect(block.style.textAlign).toBe('center');
        expect(screen.getByRole('radio', { name: 'Center' }).getAttribute('aria-checked')).toBe(
            'true',
        );
    });

    it('moves the choice with the arrow keys and keeps one tab stop', async () => {
        render(<Harness initial={documentWith(createTextBlock('<p>Hello</p>'))} />);
        await userEvent.click(screen.getByText('Hello'));

        const tabbable = () =>
            screen.getAllByRole('radio').filter((radio) => radio.getAttribute('tabindex') === '0');
        expect(tabbable().map((radio) => radio.getAttribute('aria-label'))).toEqual(['Left']);

        fireEvent.keyDown(screen.getByRole('radiogroup', { name: 'Align' }), { key: 'ArrowRight' });
        expect(tabbable().map((radio) => radio.getAttribute('aria-label'))).toEqual(['Center']);

        fireEvent.keyDown(screen.getByRole('radiogroup', { name: 'Align' }), { key: 'ArrowLeft' });
        fireEvent.keyDown(screen.getByRole('radiogroup', { name: 'Align' }), { key: 'ArrowLeft' });
        expect(tabbable().map((radio) => radio.getAttribute('aria-label'))).toEqual(['Right']);
    });
});

describe('<MailBlocks /> more columns', () => {
    async function selectFirstRow(container: HTMLElement) {
        const row = container.querySelector('.mb-row') as HTMLElement;
        await userEvent.click(row);
        return row;
    }

    it('offers a four-column layout', async () => {
        const { container } = render(
            <Harness initial={documentWith(createTextBlock('<p>A</p>'))} />,
        );
        const row = await selectFirstRow(container);

        await userEvent.click(screen.getByRole('radio', { name: '4 columns' }));
        expect(row.querySelectorAll('.mb-column')).toHaveLength(4);
    });

    it('adds columns up to six and removes them down to one', async () => {
        const { container } = render(
            <Harness initial={documentWith(createTextBlock('<p>A</p>'))} />,
        );
        const row = await selectFirstRow(container);
        const add = screen.getByRole('button', { name: 'Add column' }) as HTMLButtonElement;
        const remove = screen.getByRole('button', { name: 'Remove column' }) as HTMLButtonElement;

        expect(remove.disabled).toBe(true);
        for (let i = 0; i < 5; i++) await userEvent.click(add);
        expect(row.querySelectorAll('.mb-column')).toHaveLength(6);
        expect(add.disabled).toBe(true);
        // No preset has six columns.
        expect(
            screen
                .getAllByRole('radio')
                .filter((radio) => radio.getAttribute('aria-checked') === 'true'),
        ).toHaveLength(0);

        for (let i = 0; i < 5; i++) await userEvent.click(remove);
        expect(row.querySelectorAll('.mb-column')).toHaveLength(1);
        expect(screen.getByText('A')).toBeTruthy();
    });

    it('sets a column width and takes the difference from its neighbour', async () => {
        const doc = createEmptyDocument();
        doc.rows.push(createRow(2));
        const { container } = render(<Harness initial={doc} />);
        const row = await selectFirstRow(container);

        const first = screen.getByLabelText('Column 1') as HTMLInputElement;
        fireEvent.change(first, { target: { value: '70' } });
        fireEvent.blur(first);

        const widths = [...row.querySelectorAll('.mb-column')].map(
            (column) => (column as HTMLElement).style.width,
        );
        expect(widths).toEqual(['70%', '30%']);
        expect((screen.getByLabelText('Column 2') as HTMLInputElement).value).toBe('30');
    });

    it('keeps columns at 10% or more', async () => {
        const doc = createEmptyDocument();
        doc.rows.push(createRow(2));
        const { container } = render(<Harness initial={doc} />);
        await selectFirstRow(container);

        const first = screen.getByLabelText('Column 1') as HTMLInputElement;
        fireEvent.change(first, { target: { value: '99' } });
        fireEvent.blur(first);
        expect((screen.getByLabelText('Column 1') as HTMLInputElement).value).toBe('90');
    });
});

describe('<MailBlocks /> client report', () => {
    function withWebp() {
        return documentWith(createImageBlock('https://example.com/photo.webp', 'Photo'));
    }

    it('lists every client by how well the email renders there', async () => {
        render(<Harness initial={withWebp()} />);
        await userEvent.click(screen.getByRole('tab', { name: 'Clients' }));

        expect(screen.getByText(/Works without issues in/)).toBeTruthy();
        const problems = screen.getByRole('heading', { name: /Problems/ }).closest('section')!;
        expect(problems.textContent).toContain('Outlook Windows');
        const works = screen.getByRole('heading', { name: /Works/ }).closest('section')!;
        expect(works.textContent).toContain('Apple Mail iOS');
    });

    it("marks the editor's target clients", async () => {
        render(<Harness initial={withWebp()} />);
        await userEvent.click(screen.getByRole('tab', { name: 'Clients' }));
        expect(screen.getAllByText('target')).toHaveLength(3);
    });

    it('jumps to the block behind an issue', async () => {
        render(<Harness initial={withWebp()} />);
        await userEvent.click(screen.getByRole('tab', { name: 'Clients' }));

        const outlook = screen.getByText('Outlook Windows').closest('details')!;
        await userEvent.click(within(outlook).getByRole('button', { name: 'Image in row 1' }));

        expect(screen.getByRole('tab', { name: 'Inspector' }).getAttribute('aria-selected')).toBe(
            'true',
        );
        expect(screen.getByRole('heading', { name: 'Image' })).toBeTruthy();
    });

    it('goes back to the inspector when something is selected on the canvas', async () => {
        render(<Harness initial={withWebp()} />);
        await userEvent.click(screen.getByRole('tab', { name: 'Clients' }));
        await userEvent.click(screen.getByAltText('Photo'));
        expect(screen.getByRole('heading', { name: 'Image' })).toBeTruthy();
    });
});

describe('<MailBlocks /> phone preview and stacking', () => {
    function twoColumnDoc() {
        const doc = createEmptyDocument();
        const row = createRow(2);
        row.columns[0]?.blocks.push(createTextBlock('<p>Left</p>'));
        row.columns[1]?.blocks.push(createTextBlock('<p>Right</p>'));
        doc.rows.push(row);
        return doc;
    }

    it('shows the email at phone width with stacking rows stacked', async () => {
        const { container } = render(<Harness initial={twoColumnDoc()} />);
        const content = container.querySelector('.mb-content') as HTMLElement;
        const row = container.querySelector('.mb-row') as HTMLElement;

        expect(content.style.width).toBe('600px');
        expect(row.classList.contains('mb-row-stacked')).toBe(false);

        await userEvent.click(screen.getByRole('button', { name: 'Mobile' }));
        expect(content.style.width).toBe('375px');
        expect(row.classList.contains('mb-row-stacked')).toBe(true);
        expect(
            [...row.querySelectorAll('.mb-column')].map((c) => (c as HTMLElement).style.width),
        ).toEqual(['100%', '100%']);

        await userEvent.click(screen.getByRole('button', { name: 'Desktop' }));
        expect(content.style.width).toBe('600px');
    });

    it('keeps a row side by side on phones when stacking is turned off', async () => {
        const { container } = render(<Harness initial={twoColumnDoc()} />);
        const row = container.querySelector('.mb-row') as HTMLElement;

        await userEvent.click(row);
        const stack = screen.getByLabelText('Stack on phones') as HTMLInputElement;
        expect(stack.checked).toBe(true);
        await userEvent.click(stack);

        await userEvent.click(screen.getByRole('button', { name: 'Mobile' }));
        expect(row.classList.contains('mb-row-stacked')).toBe(false);
    });

    it('only offers stacking for rows with several columns', async () => {
        const { container } = render(
            <Harness initial={documentWith(createTextBlock('<p>Solo</p>'))} />,
        );
        await userEvent.click(container.querySelector('.mb-row') as HTMLElement);
        expect(screen.queryByLabelText('Stack on phones')).toBeNull();
    });
});

describe('<MailBlocks /> theme', () => {
    const editor = (container: HTMLElement) => container.querySelector('.mb-editor') as HTMLElement;

    it('follows the system theme by default', () => {
        const { container } = render(
            <MailBlocks document={createEmptyDocument()} onChange={vi.fn()} />,
        );
        expect(editor(container).dataset.theme).toBe('system');
    });

    it('pins the light or the dark theme', () => {
        const doc = createEmptyDocument();
        const { container, rerender } = render(
            <MailBlocks document={doc} onChange={vi.fn()} theme="dark" />,
        );
        expect(editor(container).dataset.theme).toBe('dark');
        rerender(<MailBlocks document={doc} onChange={vi.fn()} theme="light" />);
        expect(editor(container).dataset.theme).toBe('light');
    });
});

describe('<MailBlocks /> dark mode colours', () => {
    function textDoc() {
        const doc = documentWith(createTextBlock('<p>Hello</p>'));
        doc.styles.darkContentBackgroundColor = '#111111';
        return doc;
    }

    it('sets a dark colour for the selected block and clears it again', async () => {
        const onChange = vi.fn();
        render(<Harness initial={textDoc()} onChange={onChange} />);
        await userEvent.click(screen.getByText('Hello'));

        const dark = screen.getByLabelText('Dark color') as HTMLInputElement;
        // Shows the light colour until a dark one is picked.
        expect(dark.value).toBe('#000000');
        expect(screen.queryByRole('button', { name: 'Clear dark color' })).toBeNull();

        fireEvent.change(dark, { target: { value: '#eeeeee' } });
        let block = onChange.mock.lastCall![0].rows[0].columns[0].blocks[0] as TextBlock;
        expect(block.styles.darkColor).toBe('#eeeeee');
        expect(block.styles.color).toBe('#000000');

        await userEvent.click(screen.getByRole('button', { name: 'Clear dark color' }));
        block = onChange.mock.lastCall![0].rows[0].columns[0].blocks[0] as TextBlock;
        expect(block.styles.darkColor).toBeUndefined();
    });

    it('previews the email in its dark colours, keeping light ones where none is set', async () => {
        const doc = textDoc();
        (doc.rows[0]!.columns[0]!.blocks[0] as TextBlock).styles.darkColor = '#eeeeee';
        const { container } = render(<Harness initial={doc} />);
        const content = container.querySelector('.mb-content') as HTMLElement;
        const canvas = container.querySelector('.mb-canvas') as HTMLElement;
        const text = screen.getByText('Hello').closest('.mb-block') as HTMLElement;

        expect(content.style.backgroundColor).toBe('rgb(255, 255, 255)');
        expect(text.style.color).toBe('rgb(0, 0, 0)');

        await userEvent.click(screen.getByRole('button', { name: 'Dark' }));
        expect(content.style.backgroundColor).toBe('rgb(17, 17, 17)');
        expect(text.style.color).toBe('rgb(238, 238, 238)');
        // The email background has no dark colour, so it stays as it is.
        expect(canvas.style.backgroundColor).toBe('rgb(244, 244, 244)');

        await userEvent.click(screen.getByRole('button', { name: 'Light' }));
        expect(text.style.color).toBe('rgb(0, 0, 0)');
    });

    it('does not bake dark colours into the text when typing in the dark preview', async () => {
        const onChange = vi.fn();
        const doc = textDoc();
        (doc.rows[0]!.columns[0]!.blocks[0] as TextBlock).styles.darkColor = '#eeeeee';
        render(<Harness initial={doc} onChange={onChange} />);
        await userEvent.click(screen.getByRole('button', { name: 'Dark' }));

        const text = screen.getByText('Hello').closest('.mb-block') as HTMLElement;
        text.innerHTML = '<p>Hello there</p>';
        fireEvent.input(text);
        const block = onChange.mock.lastCall![0].rows[0].columns[0].blocks[0] as TextBlock;
        expect(block.html).toBe('<p>Hello there</p>');
        expect(block.styles.color).toBe('#000000');
    });

    it('offers dark backgrounds for the email and for rows, starting from the light ones', async () => {
        const { container } = render(<Harness initial={textDoc()} />);
        expect((screen.getByLabelText('Dark background') as HTMLInputElement).value).toBe(
            '#f4f4f4',
        );
        expect((screen.getByLabelText('Dark content background') as HTMLInputElement).value).toBe(
            '#111111',
        );

        await userEvent.click(container.querySelector('.mb-row') as HTMLElement);
        // A row without a background of its own starts from the content's.
        expect((screen.getByLabelText('Dark background') as HTMLInputElement).value).toBe(
            '#ffffff',
        );
    });

    it('warns where dark colours cannot be shown', async () => {
        render(<Harness initial={textDoc()} />);
        await userEvent.click(screen.getByText('Hello'));
        fireEvent.change(screen.getByLabelText('Dark color'), { target: { value: '#eeeeee' } });
        // Gmail and Outlook on Windows, of the default targets; Apple Mail on iOS shows them.
        const warnings = screen
            .getAllByText('Dark color', { selector: 'strong' })
            .map((element) => element.parentElement!);
        expect(warnings.map((warning) => warning.textContent)).toEqual([
            expect.stringContaining('Dark color in Gmail Desktop Webmail'),
            expect.stringContaining('Dark color in Outlook Windows'),
        ]);
    });

    it('explains a warning and links to the Can I Email result it comes from', async () => {
        render(<Harness initial={textDoc()} />);
        await userEvent.click(screen.getByText('Hello'));
        fireEvent.change(screen.getByLabelText('Dark color'), { target: { value: '#eeeeee' } });

        const gmail = screen
            .getByText('Gmail Desktop Webmail', { exact: false, selector: 'li' })
            .closest('li')!;
        expect(within(gmail).getByText(/Your dark colors are not used here/)).toBeTruthy();
        const source = within(gmail).getByRole('link', { name: 'Can I Email' });
        expect(source.getAttribute('href')).toBe(
            'https://www.caniemail.com/features/css-at-media-prefers-color-scheme/',
        );
        expect(source.getAttribute('target')).toBe('_blank');
        expect(source.parentElement!.textContent).toBe('Can I Email, tested version 2022-12');
    });
});

describe('<MailBlocks /> compatibility markers on the canvas', () => {
    const OUTLOOK_WINDOWS = [{ family: 'outlook', platform: 'windows' }] as const;
    const ORANGE = [{ family: 'orange', platform: 'desktop-webmail' }] as const;
    const markers = () => screen.queryAllByRole('button', { name: / issues?$/ });

    function imageDoc(src = 'https://example.com/a.webp') {
        return documentWith(createImageBlock(src, 'Photo'), createTextBlock('<p>Hello</p>'));
    }

    it('marks the blocks that have issues in the target clients, and only those', () => {
        render(
            <MailBlocks document={imageDoc()} onChange={vi.fn()} targets={[...OUTLOOK_WINDOWS]} />,
        );

        expect(markers()).toHaveLength(1);
        const marker = screen.getByRole('button', { name: 'Image block: 1 issue' });
        expect(marker.classList.contains('mb-marker-n')).toBe(true);
        expect(marker.title).toBe('Image format: not supported in Outlook Windows');
    });

    it('selects the block and shows its warnings when the marker is clicked', async () => {
        render(
            <MailBlocks document={imageDoc()} onChange={vi.fn()} targets={[...OUTLOOK_WINDOWS]} />,
        );

        // jsdom has no scrolling, so record the call instead.
        const scrolled: Element[] = [];
        const original = Element.prototype.scrollIntoView;
        Element.prototype.scrollIntoView = function (this: Element) {
            scrolled.push(this);
        };
        onTestFinished(() => {
            Element.prototype.scrollIntoView = original;
        });

        await userEvent.click(screen.getByRole('button', { name: /Image block/ }));
        expect(screen.getByRole('heading', { name: 'Image' })).toBeTruthy();
        expect(screen.getByText('Image format', { selector: 'strong' })).toBeTruthy();
        expect(scrolled.map((element) => element.textContent)).toEqual(['Warnings (1)']);
    });

    it('marks the email and rows too, coloured by their worst issue', () => {
        const doc = documentWith(createTextBlock('<p>Hello</p>'));
        doc.rows[0]!.styles.backgroundColor = '#ffffff';
        render(<MailBlocks document={doc} onChange={vi.fn()} targets={[...ORANGE]} />);

        const email = screen.getByRole('button', { name: /^Email settings: / });
        const row = screen.getByRole('button', { name: /^Row 1: / });
        const text = screen.getByRole('button', { name: /^Text block: / });
        expect(email.classList.contains('mb-marker-a')).toBe(true);
        expect(row.classList.contains('mb-marker-a')).toBe(true);
        expect(text.classList.contains('mb-marker-u')).toBe(true);
    });

    it('takes the marker away once the issue is fixed', async () => {
        render(<Harness initial={imageDoc()} />);
        // The Harness uses the default targets, which include Outlook on Windows.
        expect(screen.getByRole('button', { name: /Image block/ })).toBeTruthy();

        await userEvent.click(screen.getByAltText('Photo'));
        fireEvent.change(screen.getByLabelText('Image URL'), {
            target: { value: 'https://example.com/a.png' },
        });
        expect(screen.queryByRole('button', { name: /Image block/ })).toBeNull();
    });
});

describe('<MailBlocks /> block toolbar', () => {
    /**
     * jsdom has no execCommand, so stand in for the browser: wrap the selection
     * in the element each command would make, and record the calls.
     */
    function fakeExecCommand() {
        const calls: [string, string | undefined][] = [];
        const wrap = (element: HTMLElement) => {
            const range = document.getSelection()!.getRangeAt(0);
            range.surroundContents(element);
        };
        const original = document.execCommand;
        document.execCommand = (command: string, _ui?: boolean, value?: string) => {
            calls.push([command, value]);
            if (command === 'bold') wrap(document.createElement('b'));
            if (command === 'createLink') {
                const link = document.createElement('a');
                link.href = value!;
                wrap(link);
            }
            return true;
        };
        onTestFinished(() => {
            document.execCommand = original;
        });
        return calls;
    }

    /** Selects `word` inside the text block that shows it, and returns that block. */
    function selectWord(word: string): HTMLElement {
        const block = screen.getByText(word, { exact: false }).closest('.mb-block') as HTMLElement;
        const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
        let node = walker.nextNode();
        while (node && !node.textContent!.includes(word)) node = walker.nextNode();
        const start = node!.textContent!.indexOf(word);
        const range = document.createRange();
        range.setStart(node!, start);
        range.setEnd(node!, start + word.length);
        block.focus();
        document.getSelection()!.removeAllRanges();
        document.getSelection()!.addRange(range);
        return block;
    }

    const lastHtml = (onChange: ReturnType<typeof vi.fn>) =>
        (onChange.mock.lastCall![0].rows[0].columns[0].blocks[0] as TextBlock).html;

    /** The names of the toolbar's buttons, in order. */
    const tools = () =>
        within(screen.getByRole('toolbar', { name: 'Block tools' }))
            .getAllByRole('button')
            .map((button) => button.getAttribute('aria-label'));

    it('shows above the selected block, with the tools for its type', async () => {
        render(
            <Harness
                initial={documentWith(
                    createTextBlock('<p>Hello</p>'),
                    createButtonBlock('Shop'),
                    createSpacerBlock(),
                )}
            />,
        );
        expect(screen.queryByRole('toolbar', { name: 'Block tools' })).toBeNull();

        await userEvent.click(screen.getByText('Hello'));
        const common = ['Move up', 'Move down', 'Duplicate', 'Remove block'];
        const align = ['Align left', 'Align center', 'Align right'];
        expect(tools()).toEqual(['Bold', 'Italic', 'Link', ...align, ...common]);

        await userEvent.click(screen.getByText('Shop'));
        expect(tools()).toEqual(['Bold', 'Link', ...align, ...common]);

        await userEvent.click(document.querySelector('.mb-spacer') as HTMLElement);
        expect(tools()).toEqual(common);
    });

    it('makes the selected words bold and saves the text', async () => {
        const calls = fakeExecCommand();
        const onChange = vi.fn();
        render(
            <Harness
                initial={documentWith(createTextBlock('<p>Hello world</p>'))}
                onChange={onChange}
            />,
        );
        await userEvent.click(screen.getByText('Hello world'));
        selectWord('world');

        const bold = screen.getByRole('button', { name: 'Bold' });
        // The button must not take the focus, or the selection would go with it.
        expect(fireEvent.mouseDown(bold)).toBe(false);
        fireEvent.click(bold);

        expect(calls).toEqual([['bold', undefined]]);
        expect(lastHtml(onChange)).toBe('<p>Hello <b>world</b></p>');
        // Still selected: the click did not reach the row or the canvas.
        expect(screen.getByRole('toolbar', { name: 'Block tools' })).toBeTruthy();
    });

    it('links the selected words to the address typed in', async () => {
        const calls = fakeExecCommand();
        const onChange = vi.fn();
        render(
            <Harness
                initial={documentWith(createTextBlock('<p>Read more</p>'))}
                onChange={onChange}
            />,
        );
        await userEvent.click(screen.getByText('Read more'));
        selectWord('more');

        fireEvent.click(screen.getByRole('button', { name: 'Link' }));
        const address = screen.getByLabelText('Link address');
        fireEvent.change(address, { target: { value: 'example.com/blog' } });
        fireEvent.submit(address.closest('form')!);

        expect(calls).toEqual([['createLink', 'https://example.com/blog']]);
        expect(lastHtml(onChange)).toBe('<p>Read <a href="https://example.com/blog">more</a></p>');
        expect(screen.queryByLabelText('Link address')).toBeNull();
    });

    it('refuses addresses that are not web, email or phone links', async () => {
        const calls = fakeExecCommand();
        render(<Harness initial={documentWith(createTextBlock('<p>Read more</p>'))} />);
        await userEvent.click(screen.getByText('Read more'));
        selectWord('more');

        fireEvent.click(screen.getByRole('button', { name: 'Link' }));
        const address = screen.getByLabelText('Link address');
        fireEvent.change(address, { target: { value: 'javascript:alert(1)' } });
        fireEvent.submit(address.closest('form')!);

        expect(calls).toEqual([]);
        expect(screen.getByRole('alert').textContent).toMatch(/web address/);
        expect(address.getAttribute('aria-invalid')).toBe('true');
    });

    it('opens the link field with Ctrl+K and closes it with Escape', async () => {
        render(<Harness initial={documentWith(createTextBlock('<p>Read more</p>'))} />);
        await userEvent.click(screen.getByText('Read more'));
        const block = selectWord('more');

        fireEvent.keyDown(block, { key: 'k', ctrlKey: true });
        const address = screen.getByLabelText('Link address');
        fireEvent.keyDown(address, { key: 'Escape' });
        expect(screen.queryByLabelText('Link address')).toBeNull();
        expect(screen.getByRole('button', { name: 'Bold' })).toBeTruthy();
    });
});

describe('<MailBlocks /> block tools for every block', () => {
    function buttonDoc() {
        return documentWith(
            createTextBlock('<p>Intro</p>'),
            createButtonBlock('Shop', 'https://example.com'),
        );
    }
    const blocks = (onChange: ReturnType<typeof vi.fn>) =>
        onChange.mock.lastCall![0].rows[0].columns[0].blocks as Block[];

    it('aligns the selected block from the toolbar', async () => {
        const onChange = vi.fn();
        render(<Harness initial={buttonDoc()} onChange={onChange} />);
        await userEvent.click(screen.getByText('Shop'));

        await userEvent.click(screen.getByRole('button', { name: 'Align right' }));
        expect((blocks(onChange)[1] as ButtonBlock).styles.align).toBe('right');
        expect(
            screen.getByRole('button', { name: 'Align right' }).getAttribute('aria-pressed'),
        ).toBe('true');

        await userEvent.click(screen.getByText('Intro'));
        await userEvent.click(screen.getByRole('button', { name: 'Align center' }));
        expect((blocks(onChange)[0] as TextBlock).styles.textAlign).toBe('center');
    });

    it('makes a button bold and edits or removes its link', async () => {
        const onChange = vi.fn();
        render(<Harness initial={buttonDoc()} onChange={onChange} />);
        await userEvent.click(screen.getByText('Shop'));

        await userEvent.click(screen.getByRole('button', { name: 'Bold' }));
        expect((blocks(onChange)[1] as ButtonBlock).styles.bold).toBe(false);

        await userEvent.click(screen.getByRole('button', { name: 'Link' }));
        const address = screen.getByLabelText('Link address') as HTMLInputElement;
        expect(address.value).toBe('https://example.com');
        fireEvent.change(address, { target: { value: 'example.com/sale' } });
        fireEvent.submit(address.closest('form')!);
        expect((blocks(onChange)[1] as ButtonBlock).href).toBe('https://example.com/sale');

        await userEvent.click(screen.getByRole('button', { name: 'Link' }));
        await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
        expect((blocks(onChange)[1] as ButtonBlock).href).toBe('');
    });

    it('duplicates the selected block and selects the copy', async () => {
        const onChange = vi.fn();
        render(<Harness initial={buttonDoc()} onChange={onChange} />);
        await userEvent.click(screen.getByText('Shop'));

        await userEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
        const [, original, copy] = blocks(onChange);
        expect(copy).toMatchObject({ type: 'button', text: 'Shop' });
        expect(copy!.id).not.toBe(original!.id);
        expect(screen.getAllByText('Shop')[1]!.closest('.mb-block')!.className).toContain(
            'mb-block-selected',
        );
    });

    it('removes the selected block and clears the selection', async () => {
        const onChange = vi.fn();
        render(<Harness initial={buttonDoc()} onChange={onChange} />);
        await userEvent.click(screen.getByText('Shop'));

        await userEvent.click(screen.getByRole('button', { name: 'Remove block' }));
        expect(blocks(onChange).map((block) => block.type)).toEqual(['text']);
        expect(screen.queryByRole('toolbar', { name: 'Block tools' })).toBeNull();
        expect(screen.getByRole('heading', { name: 'Email' })).toBeTruthy();
    });

    it('removes with Delete, duplicates with Ctrl+D and lets go with Escape', async () => {
        const onChange = vi.fn();
        render(<Harness initial={buttonDoc()} onChange={onChange} />);
        const shop = screen.getByText('Shop');
        await userEvent.click(shop);

        fireEvent.keyDown(shop, { key: 'd', ctrlKey: true });
        expect(blocks(onChange).map((block) => block.type)).toEqual(['text', 'button', 'button']);

        fireEvent.keyDown(shop, { key: 'Delete' });
        expect(blocks(onChange).map((block) => block.type)).toEqual(['text', 'button']);

        await userEvent.click(screen.getByText('Shop'));
        fireEvent.keyDown(screen.getByText('Shop'), { key: 'Escape' });
        expect(screen.queryByRole('toolbar', { name: 'Block tools' })).toBeNull();
    });

    it('leaves Delete and Backspace to the text while it is being edited', async () => {
        const onChange = vi.fn();
        render(<Harness initial={buttonDoc()} onChange={onChange} />);
        const intro = screen.getByText('Intro');
        await userEvent.click(intro);
        onChange.mockClear();

        fireEvent.keyDown(intro.closest('.mb-block')!, { key: 'Backspace' });
        fireEvent.keyDown(intro.closest('.mb-block')!, { key: 'Delete' });
        expect(onChange).not.toHaveBeenCalled();
    });
});

describe('<MailBlocks /> inspector layout', () => {
    it('edits a colour as hex text, and puts back what is not a colour', async () => {
        const onChange = vi.fn();
        render(
            <Harness initial={documentWith(createTextBlock('<p>Hello</p>'))} onChange={onChange} />,
        );
        await userEvent.click(screen.getByText('Hello'));

        const hex = screen.getByLabelText('Color hex') as HTMLInputElement;
        expect(hex.value).toBe('#000000');
        fireEvent.change(hex, { target: { value: '#F60' } });
        fireEvent.blur(hex);
        const block = () => onChange.mock.lastCall![0].rows[0].columns[0].blocks[0] as TextBlock;
        expect(block().styles.color).toBe('#ff6600');
        expect((screen.getByLabelText('Color') as HTMLInputElement).value).toBe('#ff6600');

        const again = screen.getByLabelText('Color hex') as HTMLInputElement;
        fireEvent.change(again, { target: { value: 'orange' } });
        fireEvent.blur(again);
        expect(block().styles.color).toBe('#ff6600');
        expect((screen.getByLabelText('Color hex') as HTMLInputElement).value).toBe('#ff6600');
    });

    it('follows the colour picker in the hex text', async () => {
        render(<Harness initial={documentWith(createTextBlock('<p>Hello</p>'))} />);
        await userEvent.click(screen.getByText('Hello'));
        fireEvent.change(screen.getByLabelText('Color'), { target: { value: '#123456' } });
        expect((screen.getByLabelText('Color hex') as HTMLInputElement).value).toBe('#123456');
    });

    it('folds a section away and keeps it folded for the next block', async () => {
        render(
            <Harness
                initial={documentWith(createTextBlock('<p>One</p>'), createTextBlock('<p>Two</p>'))}
            />,
        );
        await userEvent.click(screen.getByText('One'));
        const spacing = screen.getByRole('button', { name: 'Spacing' });
        expect(spacing.getAttribute('aria-expanded')).toBe('true');
        expect(screen.getByLabelText('Top')).toBeTruthy();

        await userEvent.click(spacing);
        expect(spacing.getAttribute('aria-expanded')).toBe('false');
        expect(screen.queryByLabelText('Top')).toBeNull();

        await userEvent.click(screen.getByText('Two'));
        expect(screen.getByRole('button', { name: 'Spacing' }).getAttribute('aria-expanded')).toBe(
            'false',
        );
        // Other sections stay open.
        expect(screen.getByLabelText('Font size')).toBeTruthy();
    });

    it('lays the padding out two by two', async () => {
        render(<Harness initial={documentWith(createTextBlock('<p>Hello</p>'))} />);
        await userEvent.click(screen.getByText('Hello'));
        expect(
            screen.getByLabelText('Top').closest('fieldset')!.classList.contains('mb-grid'),
        ).toBe(true);
    });

    it('marks empty columns, which keep their add menu in view', () => {
        const doc = createEmptyDocument();
        const row = createRow(2);
        row.columns[0]!.blocks.push(createTextBlock('<p>Left</p>'));
        doc.rows.push(row);
        const { container } = render(<Harness initial={doc} />);
        const columns = [...container.querySelectorAll('.mb-column')];
        expect(columns.map((column) => column.classList.contains('mb-column-empty'))).toEqual([
            false,
            true,
        ]);
    });
});

describe('<MailBlocks /> email checks', () => {
    // Apple Mail on iOS supports everything these documents use, so any marker comes from lint().
    const APPLE = [{ family: 'apple-mail', platform: 'ios' }] as const;

    it('marks an image without alt text and explains it in the inspector', async () => {
        render(
            <MailBlocks
                document={documentWith(createImageBlock('https://example.com/a.png', ''))}
                onChange={vi.fn()}
                targets={[...APPLE]}
            />,
        );
        const marker = screen.getByRole('button', { name: 'Image block: 1 issue' });
        expect(marker.classList.contains('mb-marker-a')).toBe(true);
        expect(marker.title).toBe('The image has no alt text.');

        await userEvent.click(marker);
        const issue = screen.getByText('The image has no alt text.').closest('li')!;
        expect(within(issue).getByText('warning')).toBeTruthy();
        expect(within(issue).getByText(/screen readers/)).toBeTruthy();
    });

    it('marks a broken link in red', () => {
        render(
            <MailBlocks
                document={documentWith(createButtonBlock('Shop', 'shop.html'))}
                onChange={vi.fn()}
                targets={[...APPLE]}
            />,
        );
        const marker = screen.getByRole('button', { name: 'Button block: 1 issue' });
        expect(marker.classList.contains('mb-marker-n')).toBe(true);
        expect(marker.title).toBe('The button\'s link will not work: "shop.html".');
    });

    it('counts issues and compatibility warnings together', () => {
        render(
            <MailBlocks
                document={documentWith(createImageBlock('https://example.com/a.webp', ''))}
                onChange={vi.fn()}
                targets={[{ family: 'outlook', platform: 'windows' }]}
            />,
        );
        const marker = screen.getByRole('button', { name: 'Image block: 2 issues' });
        expect(marker.title.split('\n')).toEqual([
            'The image has no alt text.',
            'Image format: not supported in Outlook Windows',
        ]);
    });

    it('warns on the email itself when Gmail would clip it', () => {
        const doc = documentWith(createTextBlock(`<p>${'x'.repeat(110 * 1024)}</p>`));
        render(<MailBlocks document={doc} onChange={vi.fn()} targets={[...APPLE]} />);

        const marker = screen.getByRole('button', { name: 'Email settings: 1 issue' });
        expect(marker.classList.contains('mb-marker-n')).toBe(true);
        // Nothing selected, so the email settings show the issue.
        expect(screen.getByText(/^Gmail will clip this email/)).toBeTruthy();
    });

    it('flags text that disappears in dark mode, and clears once it has a dark colour', async () => {
        const doc = documentWith(createTextBlock('<p>Hello</p>'));
        doc.styles.darkContentBackgroundColor = '#111111';
        render(<Harness initial={doc} />);
        expect(screen.getByRole('button', { name: /^Text block: / }).title).toContain(
            'In dark mode the text is hard to read',
        );

        await userEvent.click(screen.getByText('Hello'));
        fireEvent.change(screen.getByLabelText('Dark color'), { target: { value: '#f9fafb' } });
        expect(screen.getByRole('button', { name: /^Text block: / }).title).not.toContain(
            'In dark mode',
        );
    });
});

describe('<MailBlocks /> pasting into text', () => {
    function paste(target: Element, data: Record<string, string>) {
        const event = new Event('paste', { bubbles: true, cancelable: true }) as Event & {
            clipboardData: { getData: (type: string) => string };
        };
        event.clipboardData = { getData: (type) => data[type] ?? '' };
        fireEvent(target, event);
        return event;
    }

    function recordInserts() {
        const inserted: string[] = [];
        const original = document.execCommand;
        document.execCommand = (command: string, _ui?: boolean, value?: string) => {
            if (command === 'insertHTML' || command === 'insertText') {
                inserted.push(`${command}: ${value}`);
            }
            return true;
        };
        onTestFinished(() => {
            document.execCommand = original;
        });
        return inserted;
    }

    it('pastes only the formatting a text block keeps', async () => {
        const inserted = recordInserts();
        render(<Harness initial={documentWith(createTextBlock('<p>Hello</p>'))} />);
        const block = screen.getByText('Hello').closest('.mb-block')!;
        await userEvent.click(block);

        const event = paste(block, {
            'text/html':
                '<p style="font-family:Comic Sans MS"><span style="font-weight:700">Big</span> news</p>' +
                '<p>Second <img src="x"> line</p>',
            'text/plain': 'Big news\n\nSecond line',
        });
        expect(event.defaultPrevented).toBe(true);
        expect(inserted).toEqual([
            'insertHTML: <p><strong>Big</strong> news</p><p>Second line</p>',
        ]);
    });

    it('pastes plain text as paragraphs when there is no HTML', async () => {
        const inserted = recordInserts();
        render(<Harness initial={documentWith(createTextBlock('<p>Hello</p>'))} />);
        const block = screen.getByText('Hello').closest('.mb-block')!;

        paste(block, { 'text/plain': 'one\ntwo\n\nthree' });
        expect(inserted).toEqual(['insertHTML: <p>one<br>two</p><p>three</p>']);
    });

    it('inserts a piece of a line as text, keeping its spaces', () => {
        const inserted = recordInserts();
        render(<Harness initial={documentWith(createTextBlock('<p>Hello</p>'))} />);
        const block = screen.getByText('Hello').closest('.mb-block')!;

        paste(block, {
            'text/html': '<span style="color:red"> &amp; friends</span>',
            'text/plain': ' & friends',
        });
        paste(block, { 'text/html': '<b> bold </b>' });
        expect(inserted).toEqual([
            'insertText:  & friends',
            'insertHTML: <strong>&nbsp;bold&nbsp;</strong>',
        ]);
    });

    it('tidies what the browser adds before saving the text', () => {
        const onChange = vi.fn();
        render(
            <Harness initial={documentWith(createTextBlock('<p>Hello</p>'))} onChange={onChange} />,
        );
        const block = screen.getByText('Hello').closest('.mb-block')!;
        block.innerHTML = '<p>Hello <span style="font-size:16px">joined</span></p><div>next</div>';
        fireEvent.input(block);

        const saved = onChange.mock.lastCall![0].rows[0].columns[0].blocks[0] as TextBlock;
        expect(saved.html).toBe('<p>Hello joined</p><p>next</p>');
        expect(block.innerHTML).toBe('<p>Hello joined</p><p>next</p>');
    });
});
