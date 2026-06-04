import { describe, expect, it } from 'vitest';
import { DatabaseOperationError, classifyPostgresError, mapDatabaseError } from '../db/errors.js';

describe('database error mapping', () => {
  it('maps unique violations to conflict', () => {
    expect(classifyPostgresError({ code: '23505' })).toEqual({
      code: 'DB_UNIQUE_VIOLATION',
      status: 409,
      retryable: false,
    });
  });

  it('maps invalid text representation to bad request', () => {
    expect(classifyPostgresError({ code: '22P02' })).toEqual({
      code: 'DB_INVALID_TEXT_REPRESENTATION',
      status: 400,
      retryable: false,
    });
  });

  it('maps transient pg failures as retryable', () => {
    expect(classifyPostgresError({ code: '40001' })).toEqual({
      code: 'DB_RETRYABLE_FAILURE',
      status: 503,
      retryable: true,
    });
  });

  it('wraps raw errors with operation context', () => {
    const original = new Error('duplicate');
    original.code = '23505';
    const mapped = mapDatabaseError(original, 'create user');

    expect(mapped).toBeInstanceOf(DatabaseOperationError);
    expect(mapped.code).toBe('DB_UNIQUE_VIOLATION');
    expect(mapped.status).toBe(409);
    expect(mapped.cause).toBe(original);
  });
});
