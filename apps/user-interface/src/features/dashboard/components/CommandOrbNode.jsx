import React, { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Paperclip, X, Code2 } from 'lucide-react';
import { useAgent } from '../../../hooks/useAgent';

export function CommandOrbNode({ data }) {
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [mentionedFiles, setMentionedFiles] = useState([]);
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const { sendPrompt } = useAgent();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputValue.trim() && mentionedFiles.length === 0) return;

    // Construct the context-aware prompt
    const contextStr = mentionedFiles.length > 0
      ? `\n\nContext Files:\n${mentionedFiles.map(f => `- ${f}`).join('\n')}`
      : '';

    const finalPrompt = `${inputValue}${contextStr}`;

    sendPrompt(finalPrompt);
    setInputValue('');
    setMentionedFiles([]);
    setIsFocused(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === '@') {
      setShowMentionMenu(true);
    }
  };

  const addMention = (file) => {
    if (!mentionedFiles.includes(file)) {
      setMentionedFiles([...mentionedFiles, file]);
    }
    setShowMentionMenu(false);
  };

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      className="relative z-50 flex w-[400px] items-center justify-center"
    >
      <div
        className={`w-full transition-all duration-500 ease-out rounded-full border bg-surface-container-lowest/40 backdrop-blur-2xl ${
          isFocused ? 'border-primary shadow-[0_0_40px_-10px_oklch(var(--primary))]' : 'border-white/10 shadow-2xl'
        }`}
      >
        <form onSubmit={handleSubmit} className="flex items-center gap-2 p-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles size={20} className={isFocused ? "animate-pulse" : ""} />
          </div>

          <div className="flex flex-1 flex-col gap-1">
             <AnimatePresence>
              {mentionedFiles.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex flex-wrap gap-1 px-1 pt-1"
                >
                  {mentionedFiles.map(file => (
                    <span key={file} className="flex items-center gap-1 rounded border border-white/5 bg-surface-container-high px-2 py-0.5 text-xs text-on-surface-variant">
                      <Paperclip size={10} />
                      {file}
                      <button
                        type="button"
                        onClick={() => setMentionedFiles(fs => fs.filter(f => f !== file))}
                        className="ml-1 hover:text-error"
                      >
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setTimeout(() => setIsFocused(false), 200)}
              onKeyDown={handleKeyDown}
              placeholder="Command the swarm (use @ to attach files)..."
              className="w-full border-none bg-transparent px-2 text-on-surface outline-none placeholder:text-on-surface-variant/40"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowMentionMenu(!showMentionMenu)}
            className="rounded-full p-2 text-on-surface-variant/60 transition-colors hover:bg-primary/10 hover:text-primary"
          >
             <Paperclip size={18} />
          </button>
        </form>

        <AnimatePresence>
          {showMentionMenu && (
             <motion.div
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: 10 }}
               className="absolute left-0 top-full mt-2 w-full overflow-hidden rounded-2xl border border-white/10 bg-surface-container-lowest/80 p-2 shadow-2xl backdrop-blur-3xl"
             >
                <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-on-surface-variant/50">Virtual File System Context</div>
                <div className="custom-scrollbar flex max-h-48 flex-col gap-1 overflow-y-auto">
                   {['src/App.jsx', 'package.json', 'README.md', 'src/store/useStore.js'].map(mockFile => (
                     <button
                       key={mockFile}
                       type="button"
                       onClick={() => addMention(mockFile)}
                       className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-white/5"
                     >
                       <Code2 size={14} className="text-primary/60" />
                       <span className="truncate">{mockFile}</span>
                     </button>
                   ))}
                </div>
             </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Handle type="source" position={Position.Right} id="a" className="hidden h-3 w-3 border-none bg-primary" />
    </motion.div>
  );
}
