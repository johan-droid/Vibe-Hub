import { vi } from 'vitest';
vi.mock('../db.js', () => ({
  pool: {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    on: vi.fn(),
  },
  normalizeDatabaseUrl: vi.fn(),
  __esModule: true
}));
