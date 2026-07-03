export class DatabaseOperationError extends Error {
  constructor(message, { code = 'DB_OPERATION_FAILED', cause = null, retryable = false, status = 500 } = {}) {
    super(message);
    this.name = 'DatabaseOperationError';
    this.code = code;
    this.cause = cause;
    this.retryable = retryable;
    this.status = status;
  }
}

const RETRYABLE_PG_CODES = new Set([
  '40001', // serialization_failure
  '40P01', // deadlock_detected
  '53300', // too_many_connections
  '57P01', // admin_shutdown
  '57P02', // crash_shutdown
  '57P03', // cannot_connect_now
  '08000',
  '08003',
  '08006',
]);

export function classifyPostgresError(error = {}) {
  const pgCode = error.code || error.sqlState;

  if (pgCode === '23505') {
    return { code: 'DB_UNIQUE_VIOLATION', status: 409, retryable: false };
  }
  if (pgCode === '23503') {
    return { code: 'DB_FOREIGN_KEY_VIOLATION', status: 409, retryable: false };
  }
  if (pgCode === '23502') {
    return { code: 'DB_NOT_NULL_VIOLATION', status: 400, retryable: false };
  }
  if (pgCode === '22P02') {
    return { code: 'DB_INVALID_TEXT_REPRESENTATION', status: 400, retryable: false };
  }
  if (RETRYABLE_PG_CODES.has(pgCode)) {
    return { code: 'DB_RETRYABLE_FAILURE', status: 503, retryable: true };
  }

  return { code: 'DB_OPERATION_FAILED', status: 500, retryable: false };
}

export function mapDatabaseError(error, operation = 'database operation') {
  if (error instanceof DatabaseOperationError) return error;
  const classification = classifyPostgresError(error);
  return new DatabaseOperationError(`Failed to complete ${operation}.`, {
    ...classification,
    cause: error,
  });
}
