import { useEffect, useRef, useCallback } from 'react';
import { SwarmSocket } from '../services/socket.js';
import { VFSContainer } from '../vfs/container.js';
import { useStore } from '../store/useStore';

/**
 * useAgent (v3.1) — Connects the Brain v3 to the client-side WebContainer.
 *
 * Bug Fixes in v3.1:
 * #7 — Removed destructuring of non-existent store actions `addClarification`
 *      and `addPlan`. Calling a non-function from a socket event handler crashed
 *      the entire listener and left the WebSocket in a broken state for the session.
 *
 * #8 — Named all socket event handlers so they can be passed to socket.off()
 *      in the useEffect cleanup. Previously, listeners were anonymous arrow functions
 *      stored nowhere — socket.off() had no reference to remove them. On hot-reload
 *      or auth state changes (which remount the component), each mount stacked new
 *      listeners on top of old ones, causing every event to fire N times.
 */
export function useAgent() {
  const socketRef = useRef(null);
  const vfsRef    = useRef(null);

  // BUG #7 FIX: Only destructure actions that actually exist in the store.
  // `addClarification` and `addPlan` were never defined — calling them threw
  // TypeError which crashed the socket message handler irreversibly.
  const {
    addMessage, addThought, setThinking,
    setDiffData, setVfsTree, setStreamingMessage,
  } = useStore();

  const token = localStorage.getItem('selina_token');

  useEffect(() => {
    if (!token || socketRef.current) return;

    const vfs = new VFSContainer();
    vfsRef.current = vfs;

    vfs.boot().then(() => {
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

      // BUG #8 FIX: All event handlers must be named so useEffect cleanup can
      // call socket.off(event, handler) with the exact same reference.
      // Anonymous lambdas cannot be removed — socket.off() compares by reference.
      const onThought     = (msg) => addThought(msg);
      const onThinking    = (val) => setThinking(val);
      const onStateChange = ({ state, message }) =>
        useStore.getState().setAgentStatus(state, message);
      const onStreamChunk = ({ delta }) => {
        setStreamingMessage((prev) => (prev || '') + delta);
      };

      const onResult      = (content) => {
        // Clear streaming state and push final message to history
        setStreamingMessage(null);
        addMessage({ role: 'assistant', content });
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

      // BUG #7 FIX: Clarification and plan data are embedded in addMessage()
      // with isClarification/isPlan flags — no separate store action needed.
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

      socket.connect();

      // Cleanup: remove every named listener before disconnecting.
      // Without this, remounting the component (hot-reload / auth change) stacks
      // duplicate listeners — each event fires once per mount count.
      return () => {
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
        socket.disconnect();
        socketRef.current = null;
      };
    });
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  // Note: Zustand set-actions (addMessage etc.) are stable references —
  // they never change between renders, so omitting them from deps is safe.

  const sendPrompt = useCallback((prompt) => {
    if (!socketRef.current) return;
    const effortLevel = useStore.getState().effortLevel;
    addMessage({ role: 'user', content: prompt });
    socketRef.current.sendPrompt(prompt, effortLevel);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sendClarificationAnswer = useCallback((clarificationId, answer) => {
    socketRef.current?.sendClarificationResponse(clarificationId, answer);
  }, []);

  const sendPlanApproval = useCallback((planId, approved) => {
    socketRef.current?.sendPlanResponse(planId, approved);
  }, []);

  return { sendPrompt, sendClarificationAnswer, sendPlanApproval };
}
