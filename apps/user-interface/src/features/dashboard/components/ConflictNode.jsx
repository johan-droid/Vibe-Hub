import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { AlertOctagon, Edit3, XCircle } from 'lucide-react';

export function ConflictNode({ data }) {
  const handleOverride = () => {
    if (data.onOverride) {
      data.onOverride(data.id);
    }
  };

  const handleEditAst = () => {
    if (data.onEditAst) {
      data.onEditAst(data.id);
    }
  };

  return (
    <div className="w-64 rounded-lg border border-[#FF6B6B]/40 bg-[#FF6B6B]/10 p-3 shadow-xl text-[#FFB7B7]">
      <Handle type="target" position={Position.Left} className="!border-[#FF6B6B]/50 !bg-[#0D1117]" />

      <div className="flex items-center gap-2 mb-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#FF6B6B]/30 bg-[#FF6B6B]/20">
          <AlertOctagon size={14} className="text-[#FF6B6B]" />
        </span>
        <div className="min-w-0">
          <div className="truncate text-xs font-black text-white">{data.label || 'Org Rule Conflict'}</div>
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#FF6B6B]">Conflict</div>
        </div>
      </div>

      {data.violatingLines && data.violatingLines.length > 0 && (
        <div className="mb-3 text-[11px] bg-black/40 rounded p-2 border border-[#FF6B6B]/20 font-mono">
          <div className="text-[#FFB7B7]/70 mb-1 uppercase text-[9px] tracking-wider font-bold">Violating Lines:</div>
          {data.violatingLines.map((line, i) => (
            <div key={i} className="truncate text-[#FFB7B7]">{line}</div>
          ))}
        </div>
      )}

      {data.rule && (
        <div className="mb-3 text-[11px] leading-relaxed text-[#FFB7B7]/80">
          <span className="font-bold opacity-70">Rule: </span>{data.rule}
        </div>
      )}

      <div className="flex gap-2 mt-3">
        <button
          onClick={handleEditAst}
          className="flex-1 flex items-center justify-center gap-1.5 rounded bg-black/30 border border-[#FF6B6B]/30 px-2 py-1.5 text-[10px] font-bold text-white hover:bg-[#FF6B6B]/20 transition-colors"
        >
          <Edit3 size={12} />
          <span>Edit AST</span>
        </button>
        <button
          onClick={handleOverride}
          className="flex-1 flex items-center justify-center gap-1.5 rounded bg-[#FF6B6B]/20 border border-[#FF6B6B]/40 px-2 py-1.5 text-[10px] font-bold text-[#FFB7B7] hover:bg-[#FF6B6B]/30 hover:text-white transition-colors"
        >
          <XCircle size={12} />
          <span>Override</span>
        </button>
      </div>

      <Handle type="source" position={Position.Right} className="!border-[#FF6B6B]/50 !bg-[#0D1117]" />
    </div>
  );
}

export default ConflictNode;
