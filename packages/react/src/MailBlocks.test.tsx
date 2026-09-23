import {
    createEmptyDocument,
    createRow,
    createTextBlock,
    findBlock,
    type EmailDocument,
} from '@mailblocks/core';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MailBlocks } from './MailBlocks';

function documentWith(...blocks: ReturnType<typeof createTextBlock>[]): EmailDocument {
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
        expect(next && findBlock(next, block.id)?.block.styles.fontSize).toBe(20);
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
