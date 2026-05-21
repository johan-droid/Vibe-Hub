import { useEffect, useRef, useCallback } from 'react';
import { SwarmSocket } from '../services/socket.js';
import { api } from '../services/api';
import { VFSContainer } from '../vfs/container.js';
import { useStore } from '../store/useStore';
import { initializeVfsSocket } from '../store/useVfsStore';
import { getAgentLoop } from '../services/AgentLoop.js';

/**
 * useAgent — Connects the Brain to the client-side WebContainer.
 */
export function useAgent() {
  const socketRef = useRef(null);
  const vfsRef    = useRef(null);

  const {
    addMessage, addThought, setThinking,
    setDiffData, setVfsTree, setStreamingMessage,
    setVfsStatus,
    setVfsInstance,
    setAgentLoopStatus,
    addOrchestratorEvent, setPendingApproval,
    user,
  } = useStore();

  const token = api.getToken();

  useEffect(() => {
    if (!user || socketRef.current) return;

    let cancelled = false;
    let cleanupSocket = null;
    const vfs = new VFSContainer();
    vfsRef.current = vfs;
    setVfsStatus?.('booting');
    initializeVfsSocket(user?.id || null);

    // Initialize agent loop with progress callbacks
    getAgentLoop(vfs, 
      (progress) => {
        // Progress callback
        const currentStatus = useStore.getState().agentLoopStatus;
        setAgentLoopStatus({
          isRunning: true,
          currentIteration: progress.iteration || 0,
          maxIterations: 10,
          history: [...(currentStatus.history || []), progress].slice(-200)
        });
        addOrchestratorEvent({
          type: 'state_change',
          status: 'running',
          title: progress.title || 'Agent loop progress',
          summary: progress.message || progress.summary || '',
          metadata: progress,
          source: 'selina',
        });
      },
      (result) => {
        // Complete callback
        addMessage({
          role: 'system',
          content: result.success 
            ? `✅ Agent loop completed successfully after ${result.iterations} iterations!`
            : `❌ Agent loop failed after ${result.iterations} iterations. Last error: ${result.errors?.[0]?.message || 'Unknown error'}`
        });
        setAgentLoopStatus({
          isRunning: false,
          currentIteration: result.iterations,
          maxIterations: 10,
          lastResult: result
        });
        addOrchestratorEvent({
          type: 'result',
          status: result.success ? 'completed' : 'failed',
          title: result.success ? 'Agent loop completed' : 'Agent loop failed',
          summary: result.success ? 'Validation finished successfully.' : result.errors?.[0]?.message || 'Agent loop failed.',
          metadata: result,
          source: 'selina',
        });
      },
      (error) => {
        // Error callback
        addMessage({
          role: 'system',
          content: `Agent loop error: ${error.message}`
        });
        setAgentLoopStatus({
          isRunning: false,
          error: error.message
        });
        addOrchestratorEvent({
          type: 'error',
          status: 'failed',
          title: 'Agent loop error',
          summary: error.message,
          source: 'selina',
        });
      }
    );

    vfs.boot().then(() => {
      if (cancelled) return;

      setVfsInstance?.(vfs);
      vfs.getTree('.').then(tree => setVfsTree(tree));

      const socket = new SwarmSocket(token);
      socketRef.current = socket;

      // Wire VFS as tool handler
      socket.setToolHandler(async (name, args) => {
        const result = await vfs.executeTool(name, args);

        // Emit diffs for surgical edits
        if (['edit_file', 'patch_file', 'replace_file_content', 'multi_replace_file_content'].includes(name) && result?.results) {
          const successfulEdits = result.results.filter(r => r.status === 'ok');
          if (successfulEdits.length > 0) {
            try {
              const newContent = await vfs.readFile(args.path || args.TargetFile);
              setDiffData({
                path: args.path || args.TargetFile,
                oldValue: '',
                newValue: newContent,
                isSurgical: true,
                editCount: successfulEdits.length,
              });
            } catch {}
          }
        }

        if (name === 'create_file' || name === 'write_file') {
          setDiffData({
            path: args.path,
            oldValue: '',
            newValue: args.content,
            isSurgical: false,
          });
        }

        // Refresh tree after file changes
        if (['edit_file', 'patch_file', 'replace_file_content', 'multi_replace_file_content', 'create_file', 'write_file'].includes(name)) {
          vfs.getTree('.').then(tree => setVfsTree(tree));
        }

        return result;
      });

      const onThought     = (msg) => addThought(msg);
      const onThinking    = (val) => setThinking(val);
      const onStateChange = (event) => {
        const { state, message } = event;
        useStore.getState().setAgentStatus(state, message);
        addOrchestratorEvent({
          ...event,
          type: 'state_change',
          status: state,
          title: `State: ${state}`,
          summary: message || '',
          state,
          source: 'orchestrator',
        });
      };
      const onStreamChunk = (delta) => {
        setStreamingMessage((prev) => (prev || '') + delta);
      };

      const onResult      = async (content) => {
        // Clear streaming state and push final message to history
        setStreamingMessage(null);
        addMessage({ role: 'assistant', content });
        addOrchestratorEvent({
          type: 'result',
          status: 'completed',
          title: 'Assistant response',
          summary: typeof content === 'string' ? content.slice(0, 220) : '',
          details: content,
          source: 'selina',
        });

        const activeSessionId = useStore.getState().activeSessionId;
        if (activeSessionId) {
          try {
            const { api } = await import('../services/api');
            await api.addChatMessage(activeSessionId, 'assistant', content, []);
          } catch (err) {
            console.error('Failed to save assistant message:', err);
          }
        }
      };

      const onError       = (msg) => {
        addMessage({ role: 'system', content: `Error: ${msg}` });
        addOrchestratorEvent({
          type: 'error',
          status: 'failed',
          title: 'Runtime error',
          summary: msg,
          source: 'orchestrator',
        });
      };
      const onTerminal    = (data) => {
        useStore.getState().appendTerminalOutput(data);
        addOrchestratorEvent({
          type: 'terminal_output',
          status: 'streaming',
          title: 'Terminal output',
          summary: typeof data === 'string' ? data.slice(0, 180) : '',
          details: data,
          source: 'terminal',
        });
      };
      const onToolCall    = (event) => {
        addOrchestratorEvent({
          ...event,
          type: 'tool_call',
          title: event.status === 'started'
            ? `Calling ${event.tool}`
            : `${event.tool} ${event.status || 'updated'}`,
          summary: event.error || `${event.metadata?.source || 'tool'} tool ${event.status || 'updated'}`,
        });
        setAgentLoopStatus({
          isRunning: event.status === 'started' ? true : useStore.getState().agentLoopStatus.isRunning,
        });
      };
      const onConflict    = ({ risk }) =>
        addMessage({
          role: 'system',
          content:
            `⚠️ **GitHub Conflict Detected**\n\n${risk.recommendation}\n\n` +
            `**Affected files (${risk.conflictingFiles.length}):**\n` +
            risk.conflictingFiles.map(f => `- \`${f}\``).join('\n') +
            `\n\nPlease resolve the conflicts then tell the agent to retry.`,
          isConflictWarning: true,
        });

      const onClarification = (data) => {
        addOrchestratorEvent({
          ...data,
          type: 'clarification_request',
          status: 'blocked',
          id: data.clarificationId,
          title: 'Clarification requested',
          summary: data.context,
          details: data.questions,
          source: 'selina',
        });
        addMessage({
          role:            'assistant',
          content:         `**I have some questions before proceeding:**\n\n${data.context}\n\n` +
                           data.questions.map((q, i) => `${i + 1}. ${q}`).join('\n'),
          isClarification: true,
          clarificationId: data.clarificationId,
        });
      };

      const onPlan = (data) => {
        const isApprovalGate = data.steps?.some((step) =>
          /mutate|execution|write|approval|tool can/i.test(`${step.reason || ''} ${step.action || ''}`)
        );
        setPendingApproval({
          planId: data.planId,
          steps: data.steps || [],
          risks: data.risks || [],
          kind: isApprovalGate ? 'tool_approval' : 'plan_review',
          createdAt: new Date().toISOString(),
        });
        addOrchestratorEvent({
          ...data,
          type: 'plan_request',
          status: 'approval_required',
          id: data.planId,
          title: isApprovalGate ? 'Approval gate' : 'Plan review requested',
          summary: isApprovalGate ? 'A high-risk tool needs explicit consent.' : 'Selina is waiting for plan approval.',
          details: { steps: data.steps, risks: data.risks },
          source: 'selina',
        });
        const stepsText = data.steps
          .map((s, i) => `${i + 1}. **${s.file}** — ${s.action}${s.reason ? ` _(${s.reason})_` : ''}`)
          .join('\n');
        const risksText = data.risks?.length > 0
          ? `\n\n**Risks:**\n${data.risks.map(r => `- ⚠️ ${r}`).join('\n')}`
          : '';
        addMessage({
          role:    'assistant',
          content: `**Proposed Plan:**\n\n${stepsText}${risksText}\n\n_Reply with "approve" or "reject" this plan._`,
          isPlan:  true,
          planId:  data.planId,
        });
      };

      socket.on('thought',          onThought);
      socket.on('thinking',         onThinking);
      socket.on('state_change',     onStateChange);
      socket.on('stream_chunk',     onStreamChunk);
      socket.on('result',           onResult);
      socket.on('error',            onError);
      socket.on('terminal_output',  onTerminal);
      socket.on('tool_call',        onToolCall);
      socket.on('conflict_warning', onConflict);
      socket.on('clarification',    onClarification);
      socket.on('plan',             onPlan);

      const onGithubWorkflow = (msg) => {
          useStore.getState().setWorkflowState({ status: 'completed', conclusion: msg.conclusion, url: msg.url });
          useStore.getState().appendTerminalOutput(`\x1b[36m[GitHub]\x1b[0m Workflow ${msg.workflow} completed with conclusion: ${msg.conclusion}`);
      };
      const onTaskEvent = (msg) => {
        if (msg.type === 'task_status' || msg.type === 'queue:update') {
          useStore.getState().setWorkflowState({ status: 'queue', ...msg });
        }
      };
      socket.on('github_workflow_completed', onGithubWorkflow);
      socket.on('task_event', onTaskEvent);

      socket.connect();

      // Cleanup: remove every named listener before disconnecting.
      // Without this, remounting the component (hot-reload / auth change) stacks
      // duplicate listeners — each event fires once per mount count.
      cleanupSocket = () => {
        socket.off('thought',          onThought);
        socket.off('thinking',         onThinking);
        socket.off('state_change',     onStateChange);
        socket.off('stream_chunk',     onStreamChunk);
        socket.off('result',           onResult);
        socket.off('error',            onError);
        socket.off('terminal_output',  onTerminal);
        socket.off('tool_call',        onToolCall);
        socket.off('conflict_warning', onConflict);
        socket.off('clarification',    onClarification);
        socket.off('plan',             onPlan);
        socket.off('github_workflow_completed', onGithubWorkflow);
        socket.off('task_event',       onTaskEvent);
        socket.disconnect();
        socketRef.current = null;
      };
    }).catch((err) => {
      if (cancelled) return;
      
      // Check if this is actually a success case (singleton already booted)
      if (err.message?.includes('single WebContainer instance')) {
        // WebContainer is already running, which is fine
        setVfsStatus?.('ready');
        vfs.getTree('.').then(tree => setVfsTree(tree));
        return;
      }
      
      setVfsStatus?.('error');
      addMessage({ role: 'system', content: `Workspace boot failed: ${err.message}` });
    });

    return () => {
      cancelled = true;
      cleanupSocket?.();
      socketRef.current = null;
    };
  }, [token, user]);
  // Note: Zustand set-actions (addMessage etc.) are stable references —
  // they never change between renders, so omitting them from deps is safe.

  const sendPrompt = useCallback(async (prompt) => {
    if (!socketRef.current) return;
    const effortLevel = useStore.getState().effortLevel;
    addMessage({ role: 'user', content: prompt });
    socketRef.current.sendPrompt(prompt, effortLevel);

    const activeSessionId = useStore.getState().activeSessionId;
    if (activeSessionId) {
      try {
        const { api } = await import('../services/api');
        await api.addChatMessage(activeSessionId, 'user', prompt, []);
      } catch (err) {
        console.error('Failed to save user message:', err);
      }
    }
  }, [addMessage]);

  const sendClarificationAnswer = useCallback((clarificationId, answer) => {
    socketRef.current?.sendClarificationResponse(clarificationId, answer);
  }, []);

  const sendPlanApproval = useCallback((planId, approved) => {
    socketRef.current?.sendPlanResponse(planId, approved);
    setPendingApproval(null);
    addOrchestratorEvent({
      type: 'plan_response',
      status: approved ? 'approved' : 'denied',
      id: planId,
      title: approved ? 'Approval granted' : 'Approval denied',
      summary: approved ? 'The blocked action may continue.' : 'The blocked action was denied.',
      source: 'user',
    });
  }, [addOrchestratorEvent, setPendingApproval]);

  return { sendPrompt, sendClarificationAnswer, sendPlanApproval };
}
