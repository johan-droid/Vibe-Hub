/**
 * Job Resumption Hook
 * 
 * Checks for pending jobs in localStorage on login and resumes monitoring.
 * Follows the three-tier persistence model:
 * - Tier 2: lastJobId survives logout (24h TTL)
 * - Auto-cleanup on job completion or after TTL expires
 */

import { useEffect, useCallback, useState } from 'react';
import { api } from '../services/api';
import { getLastJobId, clearLastJobId, setLastJobId } from '../utils/localStorage';
import { useStore } from '../store/useStore';

export function useJobResumption() {
  const user = useStore(state => state.user);
  const [resumingJob, setResumingJob] = useState(null);
  const setWorkflowState = useStore(state => state.setWorkflowState);
  const setAgentState = useStore(state => state.setAgentState);
  const setStatusMessage = useStore(state => state.setStatusMessage);

  /**
   * Check for pending job on login
   */
  useEffect(() => {
    if (!user) {
      setResumingJob(null);
      return;
    }

    async function checkPendingJob() {
      const lastJob = getLastJobId();
      if (!lastJob?.jobId) return;

      try {
        // Check job status
        const { job } = await api.get(`/api/code/jobs/${lastJob.jobId}`, { skipRefresh: true });
        
        if (!job) {
          // Job not found, clear it
          clearLastJobId();
          return;
        }

        // If job is still active, resume monitoring
        if (['waiting', 'active', 'delayed'].includes(job.state)) {
          setResumingJob({
            jobId: lastJob.jobId,
            requestId: lastJob.requestId,
            state: job.state,
            progress: job.progress,
          });
          
          setWorkflowState(job.state);
          setAgentState(job.state === 'active' ? 'working' : 'waiting');
          setStatusMessage(`Resumed monitoring job ${lastJob.jobId.slice(0, 8)}...`);
          
          // Give user a moment to see the resumption notice
          setTimeout(() => {
            setStatusMessage('');
          }, 5000);
        } else {
          // Job finished or failed while user was away
          clearLastJobId();
          
          if (job.state === 'completed' && job.returnvalue) {
            setStatusMessage('Previous job completed while you were away');
          } else if (job.state === 'failed') {
            setStatusMessage('Previous job failed - check logs');
          }
        }
      } catch (err) {
        // Job check failed, don't clear - might be network issue
        console.error('Failed to check job status:', err);
      }
    }

    checkPendingJob();
  }, [user, setWorkflowState, setAgentState, setStatusMessage]);

  /**
   * Track a new job for potential resumption
   */
  const trackJob = useCallback((jobId, requestId) => {
    setLastJobId(jobId, requestId);
    setResumingJob(null);
  }, []);

  /**
   * Clear tracked job (call when job completes)
   */
  const clearTrackedJob = useCallback(() => {
    clearLastJobId();
    setResumingJob(null);
  }, []);

  /**
   * Manually abandon current job tracking
   */
  const abandonJob = useCallback(() => {
    clearLastJobId();
    setResumingJob(null);
    setStatusMessage('Job monitoring stopped');
  }, [setStatusMessage]);

  return {
    resumingJob,
    trackJob,
    clearTrackedJob,
    abandonJob,
    hasPendingJob: Boolean(resumingJob),
  };
}

export default useJobResumption;
