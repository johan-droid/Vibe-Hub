import { useEffect, useRef, useCallback } from 'react';
import { SwarmSocket } from '../services/socket.js';
import { api } from '../services/api';
import { VFSContainer } from '../vfs/container.js';
import { useStore } from '../store/useStore';

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

    vfs.boot().then(() => {
      if (cancelled) return;

      vfs.getTree('.').then(tree => setVfsTree(tree));

      const socket = new SwarmSocket(token);
      socketRef.current = socket;

      // Wire VFS as tool handler
      socket.setToolHandler(async (name, args) => {
        const result = await vfs.executeTool(name, args);

        // Emit diffs for surgical edits
        if (name === 'edit_file' && result?.results) {
          const successfulEdits = result.results.filter(r => r.status === 'ok');
          if (successfulEdits.length > 0) {
            try {
              const newContent = await vfs.readFile(args.path);
              setDiffData({
                path: args.path,
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
        if (['edit_file', 'create_file', 'write_file'].includes(name)) {
          vfs.getTree('.').then(tree => setVfsTree(tree));
        }

        return result;
      });

      const onThought     = (msg) => addThought(msg);
      const onThinking    = (val) => setThinking(val);
      const onStateChange = ({ state, message }) =>
        useStore.getState().setAgentStatus(state, message);
      const onStreamChunk = (delta) => {
        setStreamingMessage((prev) => (prev || '') + delta);
      };

      const onResult      = async (content) => {
        // Clear streaming state and push final message to history
        setStreamingMessage(null);
        addMessage({ role: 'assistant', content });

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

      const onError       = (msg) =>
        addMessage({ role: 'system', content: `Error: ${msg}` });
      const onTerminal    = (data) =>
        useStore.getState().appendTerminalOutput(data);
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
        addMessage({
          role:            'assistant',
          content:         `**I have some questions before proceeding:**\n\n${data.context}\n\n` +
                           data.questions.map((q, i) => `${i + 1}. ${q}`).join('\n'),
          isClarification: true,
          clarificationId: data.clarificationId,
        });
      };

      const onPlan = (data) => {
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
  }, []);

  return { sendPrompt, sendClarificationAnswer, sendPlanApproval };
}
