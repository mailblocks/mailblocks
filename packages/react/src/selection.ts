/** What the editor has selected: a block, a row, or nothing (the whole email). */
export type Selection = { type: 'block'; id: string } | { type: 'row'; id: string };
