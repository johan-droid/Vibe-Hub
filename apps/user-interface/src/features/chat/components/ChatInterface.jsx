import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Brain,
  FileImage,
  FileUp,
  FolderGit2,
  Loader2,
  Paperclip,
  Plus,
  PlugZap,
  Send,
  ShieldCheck,
  TerminalSquare,
  User,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore } from '../../../store/useStore';
import { Button } from '../../shared/components/Button';
import { api } from '../../../services/api';

function sanitizeFileName(name) {
  return String(name || 'upload')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || 'upload';
}

function parseCliArgs(value) {
  const matches = String(value || '').match(/"[^"]*"|'[^']*'|\S+/g) || [];
  return matches.map((part) => part.replace(/^['"]|['"]$/g, ''));
}

function isTextLikeFile(file) {
  if (!file) return false;
  if (file.type?.startsWith('text/')) return true;
  return /\.(txt|md|json|js|jsx|ts|tsx|css|html|py|rs|go|yml|yaml|env|csv)$/i.test(file.name || '');
}

function ThoughtSection({ thoughts }) {
  const [expanded, setExpanded] = useState(false);
  if (!thoughts?.length) return null;

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="inline-flex items-center gap-2 rounded-full border border-outline-variant/60 bg-surface-container-low px-3 py-1.5 text-[11px] font-semibold text-on-surface-variant transition hover:text-on-surface"
      >
        <Brain size={14} className="text-primary" />
        Reasoning
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 overflow-hidden rounded-2xl border border-outline-variant/50 bg-surface-container-low"
          >
            <div className="space-y-3 p-4 text-sm text-on-surface-variant">
              {thoughts.map((thought, index) => (
                <div key={`${index}-${thought?.timestamp || index}`} className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
                  <span>{typeof thought === 'string' ? thought : thought?.content || thought?.message || ''}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MessageBubble({ role, content, thoughts = [] }) {
  const isUser = role === 'user';
  const isSystem = role === 'system';
  const label = isUser ? 'You' : isSystem ? 'Workspace' : 'Agent';
  const Icon = isUser ? User : isSystem ? TerminalSquare : ShieldCheck;

  return (
    <div className={`flex flex-col gap-2 ${isUser ? 'items-end' : 'items-start'}`}>
      <div className={`flex items-center gap-2 text-xs font-semibold ${isUser ? 'text-primary' : 'text-on-surface-variant'}`}>
        <Icon size={14} />
        <span>{label}</span>
      </div>

      <div
        className={`max-w-[min(90%,52rem)] rounded-3xl border px-4 py-3 text-sm leading-7 shadow-sm md:px-5 ${
          isUser
            ? 'border-primary/20 bg-primary text-on-primary'
            : isSystem
            ? 'border-outline-variant/60 bg-surface-container-low text-on-surface'
            : 'border-outline-variant/60 bg-surface-container-lowest text-on-surface'
        }`}
      >
        <ReactMarkdown
          components={{
            p: ({ children }) => <p className="mb-4 last:mb-0">{children}</p>,
            code({ inline, className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || '');
              if (!inline && match) {
                return (
                  <div className="my-4 overflow-hidden rounded-2xl border border-white/10 bg-[#0B1020]">
                    <SyntaxHighlighter
                      style={vscDarkPlus}
                      language={match[1]}
                      PreTag="div"
                      className="!m-0 !bg-transparent !p-4 !text-[12px]"
                      {...props}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  </div>
                );
              }

              return (
                <code
                  className={`rounded-md px-1.5 py-0.5 font-mono text-[0.92em] ${
                    isUser ? 'bg-white/15 text-white' : 'bg-primary/10 text-primary'
                  }`}
                  {...props}
                >
                  {children}
                </code>
              );
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>

      {!isUser && <ThoughtSection thoughts={thoughts} />}
    </div>
  );
}

function EmptyState({ onTemplate }) {
  const suggestions = [
    'Clone and scan https://github.com/owner/repo, then summarize the architecture.',
    'Review the latest staged diff and explain the risk before I approve it.',
    'Inspect the uploaded files and tell me what the agent should work on next.',
  ];

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="max-w-2xl text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-3xl border border-outline-variant/60 bg-surface-container-low">
          <ShieldCheck size={28} className="text-primary" />
        </div>
        <h2 className="text-3xl font-semibold tracking-tight text-on-surface">Simple agent chat, wired to the real workspace</h2>
        <p className="mt-3 text-base leading-7 text-on-surface-variant">
          Use the plus button to clone a repository, upload files or images into the live workspace, or register an MCP connector.
        </p>

        <div className="mt-8 grid gap-3 text-left md:grid-cols-3">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => onTemplate(suggestion)}
              className="rounded-2xl border border-outline-variant/50 bg-surface-container-low px-4 py-4 text-sm text-on-surface transition hover:border-primary/40 hover:bg-surface-container"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ContextChip({ icon: Icon, label, tone = 'default' }) {
  const toneClass = tone === 'warning'
    ? 'border-amber-400/20 bg-amber-400/10 text-amber-300'
    : 'border-outline-variant/50 bg-surface-container-low text-on-surface-variant';

  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${toneClass}`}>
      <Icon size={13} />
      <span>{label}</span>
    </div>
  );
}

export default function ChatInterface({ onSend, onContextChange }) {
  const {
    messages,
    streamingMessage,
    isThinking,
    agentThoughts,
    linkedProjects,
    uploadedFiles,
    vfsInstance,
    addMessage,
    addProject,
    addUploadedFile,
    setVfsTree,
  } = useStore();

  const [input, setInput] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState('repo');
  const [repoUrl, setRepoUrl] = useState('');
  const [mcpName, setMcpName] = useState('');
  const [mcpCommand, setMcpCommand] = useState('');
  const [mcpArgs, setMcpArgs] = useState('');
  const [busyAction, setBusyAction] = useState(null);
  const [status, setStatus] = useState(null);

  const scrollRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);

  useEffect(() => {
    if (!scrollRef.current) return;
    const element = scrollRef.current;
    const isNearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 220;
    if (isNearBottom) {
      element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, streamingMessage, isThinking]);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = '0px';
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 220)}px`;
  }, [input]);

  const contextChips = useMemo(() => {
    const chips = [];
    linkedProjects.forEach((project) => {
      chips.push({ id: `repo-${project.id}`, icon: FolderGit2, label: project.name });
    });
    uploadedFiles.forEach((file) => {
      chips.push({
        id: `file-${file.id}`,
        icon: file.type?.startsWith('image/') ? FileImage : Paperclip,
        label: file.path ? `${file.name} · ${file.path}` : file.name,
      });
    });
    return chips.slice(-8);
  }, [linkedProjects, uploadedFiles]);

  const setNotice = (kind, message) => {
    setStatus({ kind, message });
  };

  const handleSend = () => {
    if (!input.trim() || isThinking) return;
    onSend(input.trim());
    setInput('');
  };

  const refreshWorkspaceTree = async () => {
    if (!vfsInstance) return;
    try {
      const tree = await vfsInstance.getTree('.');
      setVfsTree(tree);
    } catch {}
  };

  const handleCloneRepo = async () => {
    if (!repoUrl.trim()) return;
    setBusyAction('repo');

    try {
      const response = await api.linkRepo(repoUrl.trim());
      if (!response?.success) {
        throw new Error(response?.error || 'Repository clone failed.');
      }

      addProject(response.project);
      addMessage({
        role: 'system',
        content: `Repository cloned and indexed: \`${response.project.name}\`${response.project.indexedSymbols ? ` with ${response.project.indexedSymbols} indexed symbols` : ''}.`,
      });
      setNotice('success', `Cloned and scanned ${response.project.name}.`);
      setRepoUrl('');
      setMenuOpen(false);
      onContextChange?.();
    } catch (error) {
      setNotice('error', error.message);
    } finally {
      setBusyAction(null);
    }
  };

  const importFilesIntoWorkspace = async (files, bucket) => {
    if (!files?.length) return;
    if (!vfsInstance) {
      setNotice('error', 'Workspace container is still starting. Try again in a moment.');
      return;
    }

    setBusyAction('upload');
    try {
      const selectedFiles = Array.from(files);
      const imported = [];

      for (const [index, file] of selectedFiles.entries()) {
        const safeName = sanitizeFileName(file.name);
        const targetPath = `/uploads/${bucket}/${Date.now()}-${index}-${safeName}`;
        const bytes = new Uint8Array(await file.arrayBuffer());
        await vfsInstance.createFile(targetPath, bytes);

        imported.push({
          id: `${Date.now()}-${index}-${safeName}`,
          name: file.name,
          size: file.size,
          path: targetPath,
          type: file.type || (bucket === 'images' ? 'image/*' : 'application/octet-stream'),
        });

        if (selectedFiles.length === 1 && isTextLikeFile(file)) {
          addMessage({
            role: 'system',
            content: `Imported \`${file.name}\` into \`${targetPath}\`. The agent can inspect it from the live workspace.`,
          });
        }
      }

      imported.forEach((file) => addUploadedFile(file));
      await refreshWorkspaceTree();
      setNotice('success', `Imported ${imported.length} file${imported.length === 1 ? '' : 's'} into /uploads/${bucket}.`);
      setMenuOpen(false);
      onContextChange?.();
    } catch (error) {
      setNotice('error', error.message);
    } finally {
      setBusyAction(null);
    }
  };

  const handleRegisterMcp = async () => {
    if (!mcpName.trim() || !mcpCommand.trim()) return;
    setBusyAction('mcp');

    try {
      const response = await api.registerMcpServer(
        mcpName.trim(),
        mcpCommand.trim(),
        parseCliArgs(mcpArgs)
      );

      if (!response?.success) {
        throw new Error(response?.error || 'Failed to register MCP server.');
      }

      addMessage({
        role: 'system',
        content: `MCP connector registered: \`${mcpName.trim()}\` using \`${mcpCommand.trim()}\`.`,
      });
      setNotice('success', `Registered MCP server ${mcpName.trim()}.`);
      setMcpName('');
      setMcpCommand('');
      setMcpArgs('');
      setMenuOpen(false);
      onContextChange?.();
    } catch (error) {
      setNotice('error', error.message);
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-6 md:px-8">
        {messages.length === 0 && !streamingMessage && !isThinking ? (
          <EmptyState onTemplate={setInput} />
        ) : (
          <>
            {messages.map((message, index) => (
              <MessageBubble
                key={message.id || `message-${index}`}
                role={message.role}
                content={message.content}
                thoughts={message.thoughts || []}
              />
            ))}

            {streamingMessage && (
              <MessageBubble role="assistant" content={streamingMessage} thoughts={agentThoughts} />
            )}

            {isThinking && !streamingMessage && (
              <div className="flex items-center gap-3 px-1 text-sm text-on-surface-variant">
                <Loader2 size={16} className="animate-spin text-primary" />
                <span>The agent is working.</span>
              </div>
            )}
          </>
        )}
      </div>

      <div className="border-t border-outline-variant/50 bg-surface-container-low/70 px-4 py-4 backdrop-blur md:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="mb-3 flex flex-wrap gap-2">
            {contextChips.map((chip) => (
              <ContextChip key={chip.id} icon={chip.icon} label={chip.label} />
            ))}
            {!vfsInstance && (
              <ContextChip icon={Loader2} label="Workspace booting" tone="warning" />
            )}
          </div>

          {status?.message && (
            <div
              className={`mb-3 rounded-2xl border px-4 py-3 text-sm ${
                status.kind === 'error'
                  ? 'border-red-400/20 bg-red-400/10 text-red-200'
                  : 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
              }`}
            >
              {status.message}
            </div>
          )}

          <div className="relative rounded-3xl border border-outline-variant/60 bg-surface-container-lowest shadow-sm">
            <div className="flex items-end gap-2 px-3 py-3">
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setMenuOpen((value) => !value)}
                  className="flex h-11 w-11 items-center justify-center rounded-2xl border border-outline-variant/60 bg-surface-container-low text-on-surface transition hover:border-primary/40 hover:text-primary"
                  aria-label="Add repo, file, image, or MCP connector"
                >
                  <Plus size={18} />
                </button>

                <AnimatePresence>
                  {menuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.98 }}
                      className="absolute bottom-14 left-0 z-20 w-[min(28rem,calc(100vw-2rem))] rounded-3xl border border-outline-variant/60 bg-surface-container-lowest p-4 shadow-2xl"
                    >
                      <div className="mb-3 flex flex-wrap gap-2">
                        {[
                          { id: 'repo', label: 'Clone Repo', icon: FolderGit2 },
                          { id: 'files', label: 'Upload Files', icon: FileUp },
                          { id: 'images', label: 'Upload Images', icon: FileImage },
                          { id: 'mcp', label: 'Add MCP', icon: PlugZap },
                        ].map(({ id, label, icon: Icon }) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setActiveMenu(id)}
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition ${
                              activeMenu === id
                                ? 'border-primary/30 bg-primary/10 text-primary'
                                : 'border-outline-variant/50 bg-surface-container-low text-on-surface-variant hover:text-on-surface'
                            }`}
                          >
                            <Icon size={14} />
                            {label}
                          </button>
                        ))}
                      </div>

                      {activeMenu === 'repo' && (
                        <div className="space-y-3">
                          <p className="text-sm text-on-surface-variant">Clone a real repository into the backend mirror and index it for the agent.</p>
                          <input
                            type="url"
                            value={repoUrl}
                            onChange={(event) => setRepoUrl(event.target.value)}
                            placeholder="https://github.com/owner/repo"
                            className="h-11 w-full rounded-2xl border border-outline-variant/60 bg-surface-container-low px-4 text-sm text-on-surface outline-none transition focus:border-primary/40"
                          />
                          <Button
                            variant="filled"
                            onClick={handleCloneRepo}
                            disabled={busyAction === 'repo' || !repoUrl.trim()}
                            className="!rounded-2xl"
                          >
                            {busyAction === 'repo' ? <Loader2 size={16} className="animate-spin" /> : <FolderGit2 size={16} />}
                            <span>Clone and Scan</span>
                          </Button>
                        </div>
                      )}

                      {activeMenu === 'files' && (
                        <div className="space-y-3">
                          <p className="text-sm text-on-surface-variant">Import documents, source files, or datasets into the live workspace at <code>/uploads/files</code>.</p>
                          <Button
                            variant="tonal"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={busyAction === 'upload'}
                            className="!rounded-2xl"
                          >
                            {busyAction === 'upload' ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16} />}
                            <span>Select Files</span>
                          </Button>
                        </div>
                      )}

                      {activeMenu === 'images' && (
                        <div className="space-y-3">
                          <p className="text-sm text-on-surface-variant">Import screenshots or reference images into the live workspace at <code>/uploads/images</code>.</p>
                          <Button
                            variant="tonal"
                            onClick={() => imageInputRef.current?.click()}
                            disabled={busyAction === 'upload'}
                            className="!rounded-2xl"
                          >
                            {busyAction === 'upload' ? <Loader2 size={16} className="animate-spin" /> : <FileImage size={16} />}
                            <span>Select Images</span>
                          </Button>
                        </div>
                      )}

                      {activeMenu === 'mcp' && (
                        <div className="space-y-3">
                          <p className="text-sm text-on-surface-variant">Register an MCP server with the backend so it becomes part of the live connector inventory.</p>
                          <input
                            type="text"
                            value={mcpName}
                            onChange={(event) => setMcpName(event.target.value)}
                            placeholder="Server name"
                            className="h-11 w-full rounded-2xl border border-outline-variant/60 bg-surface-container-low px-4 text-sm text-on-surface outline-none transition focus:border-primary/40"
                          />
                          <input
                            type="text"
                            value={mcpCommand}
                            onChange={(event) => setMcpCommand(event.target.value)}
                            placeholder="Command"
                            className="h-11 w-full rounded-2xl border border-outline-variant/60 bg-surface-container-low px-4 text-sm text-on-surface outline-none transition focus:border-primary/40"
                          />
                          <input
                            type="text"
                            value={mcpArgs}
                            onChange={(event) => setMcpArgs(event.target.value)}
                            placeholder='Arguments, for example: --stdio --port 3002'
                            className="h-11 w-full rounded-2xl border border-outline-variant/60 bg-surface-container-low px-4 text-sm text-on-surface outline-none transition focus:border-primary/40"
                          />
                          <Button
                            variant="filled"
                            onClick={handleRegisterMcp}
                            disabled={busyAction === 'mcp' || !mcpName.trim() || !mcpCommand.trim()}
                            className="!rounded-2xl"
                          >
                            {busyAction === 'mcp' ? <Loader2 size={16} className="animate-spin" /> : <PlugZap size={16} />}
                            <span>Register MCP</span>
                          </Button>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    handleSend();
                  }
                }}
                disabled={isThinking}
                placeholder="Ask the agent to inspect code, explain a diff, or work on the linked repo..."
                className="max-h-[220px] min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2 text-sm text-on-surface outline-none placeholder:text-on-surface-variant/70"
              />

              <Button
                variant="filled"
                size="lg"
                disabled={isThinking || !input.trim()}
                onClick={handleSend}
                className="!h-11 !w-11 !rounded-2xl !p-0"
              >
                <Send size={18} />
              </Button>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(event) => {
              importFilesIntoWorkspace(event.target.files, 'files');
              event.target.value = '';
            }}
          />
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => {
              importFilesIntoWorkspace(event.target.files, 'images');
              event.target.value = '';
            }}
          />
        </div>
      </div>
    </div>
  );
}
