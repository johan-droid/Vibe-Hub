import { describe, expect, it } from 'vitest';
import { normalizeDatabaseUrl } from '../db.js';

describe('Database URL normalization', () => {
  it('keeps non-production database URLs unchanged', () => {
    const url = 'postgres://user:pass@example.com:5432/app?sslmode=require';

    expect(normalizeDatabaseUrl(url, { NODE_ENV: 'test' })).toBe(url);
  });

  it('uses verify-full in production when Render-style sslmode=require is present', () => {
    const normalized = normalizeDatabaseUrl(
      'postgres://user:pass@example.com:5432/app?sslmode=require',
      { NODE_ENV: 'production' }
    );

    expect(new URL(normalized).searchParams.get('sslmode')).toBe('verify-full');
  });

  it('preserves an explicit production SSL mode override', () => {
    const normalized = normalizeDatabaseUrl(
      'postgres://user:pass@example.com:5432/app?sslmode=require',
      { NODE_ENV: 'production', DATABASE_SSL_MODE: 'verify-full' }
    );

    expect(new URL(normalized).searchParams.get('sslmode')).toBe('verify-full');
  });
});
