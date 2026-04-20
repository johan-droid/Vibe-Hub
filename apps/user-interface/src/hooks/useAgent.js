import { useEffect, useRef, useCallback } from 'react';
import { SwarmSocket } from '../services/socket.js';
import { VFSContainer } from '../vfs/container.js';
import { useStore } from '../store/useStore';

/**
 * useAgent (v3.0) — Connects the Brain v3 to the client-side WebContainer.
 * 
 * New in v3:
 * - Handles clarification requests (Brain asks questions → UI shows → user answers)
 * - Handles plan reviews (Brain proposes plan → UI shows → user approves/rejects)
 * - Surgical edit support via edit_file tool
 */
export function useAgent() {
  const socketRef = useRef(null);
  const vfsRef = useRef(null);

  const {
    user, addMessage, addThought, setThinking,
    setVfsStatus, setDiffData, setVfsTree,
    addClarification, addPlan,
  } = useStore();

  const token = localStorage.getItem('vibe_token');

  useEffect(() => {
    if (!token || socketRef.current) return;

    const vfs = new VFSContainer();
    vfsRef.current = vfs;

    setVfsStatus('booting');
    vfs.boot().then(() => {
      setVfsStatus('ready');
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
            // Read the file back to show the result
            try {
              const newContent = await vfs.readFile(args.path);
              setDiffData({
                path: args.path,
                oldValue: '', // We don't have the old content cached
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

      // Wire event listeners
      socket.on('thought', (msg) => addThought(msg));
      socket.on('thinking', (val) => setThinking(val));
      socket.on('state_change', ({ state, message }) => useStore.getState().setAgentStatus(state, message));
      socket.on('result', (content) => {
        addMessage({ role: 'assistant', content });
      });
      socket.on('error', (msg) => {
        addMessage({ role: 'system', content: `Error: ${msg}` });
      });

      // v3: Clarification flow
      socket.on('clarification', (data) => {
        addClarification(data);
        addMessage({
          role: 'assistant',
          content: `**I have some questions before proceeding:**\n\n${data.context}\n\n${data.questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`,
          isClarification: true,
          clarificationId: data.clarificationId,
        });
      });

      // v3: Plan flow
      socket.on('plan', (data) => {
        addPlan(data);
        const stepsText = data.steps.map((s, i) => `${i + 1}. **${s.file}** — ${s.action}${s.reason ? ` _(${s.reason})_` : ''}`).join('\n');
        const risksText = data.risks?.length > 0
          ? `\n\n**Risks:**\n${data.risks.map(r => `- ⚠️ ${r}`).join('\n')}`
          : '';
        addMessage({
          role: 'assistant',
          content: `**Proposed Plan:**\n\n${stepsText}${risksText}\n\n_Reply with "approve" or "reject" this plan._`,
          isPlan: true,
          planId: data.planId,
        });
      });

      socket.connect();
    });

    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  const sendPrompt = useCallback((prompt) => {
    if (!socketRef.current) return;
    const effortLevel = useStore.getState().effortLevel;
    addMessage({ role: 'user', content: prompt });
    socketRef.current.sendPrompt(prompt, effortLevel);
  }, []);

  const sendClarificationAnswer = useCallback((clarificationId, answer) => {
    if (!socketRef.current) return;
    socketRef.current.sendClarificationResponse(clarificationId, answer);
  }, []);

  const sendPlanApproval = useCallback((planId, approved) => {
    if (!socketRef.current) return;
    socketRef.current.sendPlanResponse(planId, approved);
  }, []);

  return { sendPrompt, sendClarificationAnswer, sendPlanApproval };
}
