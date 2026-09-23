import {
    createButtonBlock,
    createEmptyDocument,
    createImageBlock,
    createRow,
    createTextBlock,
    findBlock,
    type Block,
    type EmailDocument,
    type TextBlock,
} from '@mailblocks/core';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
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

        expect(screen.getByText('Select a block to edit it.')).toBeTruthy();
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

        await userEvent.click(screen.getByText('+ Text'));

        const next = onChange.mock.calls[0]?.[0];
        expect(next?.rows[0]?.columns[0]?.blocks).toHaveLength(2);
    });

    it('shows compatibility warnings for the selected block', async () => {
        const doc = documentWith(createTextBlock('<p>Hello</p>'));
        render(
            <MailBlocks
                document={doc}
                onChange={vi.fn()}
                targets={[{ family: 'outlook', platform: 'windows' }]}
            />,
        );

        await userEvent.click(screen.getByText('Hello'));
        expect(screen.getAllByText('partial').length).toBeGreaterThan(0);
        expect(screen.getByText('lineHeight')).toBeTruthy();
    });
});

describe('<MailBlocks /> with image blocks', () => {
    it('adds an image block and edits its URL in the inspector', async () => {
        const doc = documentWith(createTextBlock('<p>Hello</p>'));
        const onChange = vi.fn<(doc: EmailDocument) => void>();
        render(<Harness initial={doc} onChange={onChange} />);

        await userEvent.click(screen.getByText('+ Image'));

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
        expect(screen.getByText('src')).toBeTruthy();
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

        await userEvent.click(screen.getByText('+ Button'));
        fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'Buy now' } });

        expect(screen.getByText('Buy now')).toBeTruthy();
    });

    it('warns about rounded corners in Outlook for the selected button', async () => {
        render(
            <MailBlocks
                document={documentWith(createButtonBlock('Shop'))}
                onChange={vi.fn()}
                targets={[{ family: 'outlook', platform: 'windows' }]}
            />,
        );

        await userEvent.click(screen.getByText('Shop'));
        expect(screen.getByText('borderRadius')).toBeTruthy();
        expect(screen.getAllByText('not supported').length).toBeGreaterThan(0);
    });
});
