// Testing Library only unmounts rendered trees automatically when `afterEach`
// is a global, which vitest does not provide unless `globals` is on. Wire it up.
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(cleanup);
