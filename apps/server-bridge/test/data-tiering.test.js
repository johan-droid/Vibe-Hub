import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { dataTieringEngine } from '../orchestrator/data-tiering.js';
import { pool } from '../db.js';
import fs from 'fs';
import zlib from 'zlib';

vi.mock('../db.js', () => ({
  pool: {
    query: vi.fn(),
  },
}));

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
  },
}));

describe('DataTieringEngine', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    dataTieringEngine.s3Endpoint = '';
    dataTieringEngine.s3AccessKey = '';
  });

  afterEach(() => {
    dataTieringEngine.stop();
  });

  it('should skip archival if no trace root entries are older than 30 days', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }); // 0 old traces found

    const archiveSpy = vi.spyOn(dataTieringEngine, 'uploadToS3');
    const diskSpy = vi.spyOn(dataTieringEngine, 'saveToLocalArchive');

    await dataTieringEngine.runArchival();

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('started_at < NOW() -'),
      expect.any(Array)
    );
    expect(archiveSpy).not.toHaveBeenCalled();
    expect(diskSpy).not.toHaveBeenCalled();
  });

  it('should pull, serialize, compress and archive traces exceeding retention rules', async () => {
    // 1. Return 1 old root run
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 'old-run-uuid-1', started_at: '2026-04-10T12:00:00Z', user_id: 'u1', project_name: 'p1' }],
    });

    // 2. Return tree subruns
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 'old-run-uuid-1', status: 'completed' }],
    });

    // 3. Return tree events
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 'event-1', method: 'planner_step', sequence: 0 }],
    });

    // 4. Mock local file write success
    fs.existsSync.mockReturnValue(true);
    fs.writeFileSync.mockImplementation(() => {});

    // 5. Mock delete and VACUUM success
    pool.query.mockResolvedValue({ rowCount: 1 });

    const diskSpy = vi.spyOn(dataTieringEngine, 'saveToLocalArchive');
    const deleteSpy = vi.spyOn(pool, 'query');

    await dataTieringEngine.runArchival();

    // Verify zlib-compressed saving was invoked
    expect(diskSpy).toHaveBeenCalledWith(
      expect.stringContaining('old-run-uuid-1.json.gz'),
      expect.any(Buffer)
    );

    // Verify compressed buffer is indeed valid gzip data
    const compressedBuffer = diskSpy.mock.calls[0][1];
    const decompressed = zlib.gunzipSync(compressedBuffer).toString('utf-8');
    const traceObj = JSON.parse(decompressed);

    expect(traceObj.rootRunId).toBe('old-run-uuid-1');
    expect(traceObj.runs).toHaveLength(1);
    expect(traceObj.events).toHaveLength(1);

    // Verify Postgres purge delete statement executed
    expect(deleteSpy).toHaveBeenCalledWith(
      'DELETE FROM agent_runs WHERE id = $1',
      ['old-run-uuid-1']
    );
  });
});
