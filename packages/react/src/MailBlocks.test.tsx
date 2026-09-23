import {
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
