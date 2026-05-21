import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import fetch from 'node-fetch';
import { pool } from '../db.js';
import logger from '../utils/detailed-logger.js';

class DataTieringEngine {
  constructor() {
    this.s3Endpoint = process.env.S3_ENDPOINT || '';
    this.s3Bucket = process.env.S3_BUCKET || 'selina-traces';
    this.s3AccessKey = process.env.S3_ACCESS_KEY || '';
    this.s3SecretKey = process.env.S3_SECRET_KEY || '';
    this.localFallbackPath = process.env.LOCAL_ARCHIVE_PATH || path.join(process.cwd(), 'archive', 'traces');
    this.archiveAgeDays = Number.parseInt(process.env.ARCHIVE_AGE_DAYS || '30', 10);
    this.scheduleInterval = null;
  }

  initialize() {
    logger.info('DataTiering', 'Initializing Data Tiering Engine. Trace retention configured for 30 days.');
    
    // Run immediate check on startup
    this.runArchival().catch(err => {
      logger.error('DataTiering', `Startup trace archival failed: ${err.message}`);
    });

    // Run scheduled archival check every 24 hours
    const twentyFourHoursMs = 24 * 60 * 60 * 1000;
    this.scheduleInterval = setInterval(() => {
      this.runArchival().catch(err => {
        logger.error('DataTiering', `Scheduled trace archival failed: ${err.message}`);
      });
    }, twentyFourHoursMs);
  }

  async runArchival() {
    logger.info('DataTiering', `Starting trace archival scan for runs older than ${this.archiveAgeDays} days...`);

    try {
      // 1. Find root runs completed or started >30 days ago
      const findOldRunsQuery = `
        SELECT id, started_at, user_id, project_name 
        FROM agent_runs 
        WHERE parent_run_id IS NULL 
          AND started_at < NOW() - $1 * INTERVAL '1 day'
        LIMIT 100
      `;
      
      const { rows: oldRuns } = await pool.query(findOldRunsQuery, [this.archiveAgeDays]);
      
      if (oldRuns.length === 0) {
        logger.info('DataTiering', 'No old agent traces found requiring archival.');
        return;
      }

      logger.info('DataTiering', `Found ${oldRuns.length} root trace trees to archive. Commencing serialization & compression...`);

      let archivedCount = 0;

      for (const run of oldRuns) {
        try {
          const runId = run.id;

          // 2. Fetch all runs in the hierarchical execution tree
          const { rows: treeRuns } = await pool.query(
            'SELECT * FROM agent_runs WHERE root_run_id = $1',
            [runId]
          );

          // 3. Fetch all events for this execution tree
          const { rows: treeEvents } = await pool.query(
            'SELECT * FROM agent_run_events WHERE root_run_id = $1 ORDER BY sequence ASC',
            [runId]
          );

          const tracePayload = {
            rootRunId: runId,
            archivedAt: new Date().toISOString(),
            runs: treeRuns,
            events: treeEvents,
          };

          // 4. Compress trace hierarchy using native zlib Gzip
          const jsonString = JSON.stringify(tracePayload);
          const compressedPayload = zlib.gzipSync(Buffer.from(jsonString, 'utf-8'));

          // 5. Upload to Cold Storage (S3 REST or local disk fallback)
          const targetKey = `traces/year=${new Date(run.started_at).getFullYear()}/month=${String(new Date(run.started_at).getMonth() + 1).padStart(2, '0')}/${runId}.json.gz`;
          
          let uploadSuccess = false;
          if (this.s3Endpoint && this.s3AccessKey) {
            uploadSuccess = await this.uploadToS3(targetKey, compressedPayload);
          } else {
            uploadSuccess = await this.saveToLocalArchive(targetKey, compressedPayload);
          }

          if (uploadSuccess) {
            // 6. Purge historical records from Postgres (Cascade deletes subruns and events automatically)
            await pool.query('DELETE FROM agent_runs WHERE id = $1', [runId]);
            archivedCount++;
            logger.info('DataTiering', `Successfully archived and purged trace tree ${runId}`);
          }
        } catch (runErr) {
          logger.error('DataTiering', `Failed to archive trace tree ${run.id}: ${runErr.message}`);
        }
      }

      logger.info('DataTiering', `Trace archival sweep finished. Purged ${archivedCount} root trees from active DB.`);
      
      if (archivedCount > 0) {
        logger.info('DataTiering', 'Triggering Postgres VACUUM ANALYZE to reclaim disk space...');
        pool.query('VACUUM ANALYZE agent_runs').catch(err => {
          logger.warn('DataTiering', `Postgres VACUUM warning: ${err.message}`);
        });
      }
    } catch (err) {
      logger.error('DataTiering', `Archival sequence aborted: ${err.message}`);
    }
  }

  async uploadToS3(key, buffer) {
    const url = `${this.s3Endpoint.replace(/\/$/, '')}/${this.s3Bucket}/${key}`;
    logger.info('DataTiering', `Uploading archived trace to cold S3 endpoint: ${url}`);

    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/x-gzip',
          'Content-Encoding': 'gzip',
          // Simple auth signature helper (compatible with MinIO and R2 public write / basic gates)
          'Authorization': `Bearer ${this.s3AccessKey}:${this.s3SecretKey}`
        },
        body: buffer
      });

      if (!response.ok) {
        throw new Error(`S3 PUT failed with status ${response.status}: ${await response.text()}`);
      }

      return true;
    } catch (err) {
      logger.error('DataTiering', `S3 cold storage upload error: ${err.message}. Falling back to disk storage.`);
      return await this.saveToLocalArchive(key, buffer);
    }
  }

  async saveToLocalArchive(key, buffer) {
    const targetFile = path.join(this.localFallbackPath, key);
    const targetDir = path.dirname(targetFile);

    logger.debug('DataTiering', `Saving trace payload locally: ${targetFile}`);

    try {
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      fs.writeFileSync(targetFile, buffer);
      return true;
    } catch (err) {
      logger.error('DataTiering', `Local disk archival failed: ${err.message}`);
      return false;
    }
  }

  stop() {
    if (this.scheduleInterval) {
      clearInterval(this.scheduleInterval);
    }
  }
}

export const dataTieringEngine = new DataTieringEngine();
