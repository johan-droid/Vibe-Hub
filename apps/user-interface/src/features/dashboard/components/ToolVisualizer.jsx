import React, { useMemo } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { GitBranch, Network, ShieldAlert, Wrench } from 'lucide-react';

const statusTone = {
  started: 'border-[#8DA2FF]/35 bg-[#8DA2FF]/10 text-[#B8C5FF]',
  streaming: 'border-[#8DA2FF]/35 bg-[#8DA2FF]/10 text-[#B8C5FF]',
  completed: 'border-[#43F3C5]/35 bg-[#43F3C5]/10 text-[#A7FFE9]',
  failed: 'border-[#FF6B6B]/35 bg-[#FF6B6B]/10 text-[#FFB7B7]',
  approval_required: 'border-[#F7C35F]/35 bg-[#F7C35F]/10 text-[#FFE1A0]',
};

function ToolNode({ data }) {
  const Icon = data.nodeKind === 'run' ? Network : data.source === 'mcp' ? GitBranch : data.status === 'approval_required' ? ShieldAlert : Wrench;
  const tone = statusTone[data.status] || 'border-white/10 bg-white/[0.045] text-white/65';

  return (
    <div className={`w-52 rounded-lg border p-3 shadow-xl ${tone}`}>
      <Handle type="target" position={Position.Left} className="!border-white/30 !bg-[#0D1117]" />
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-current/25 bg-black/20">
          <Icon size={14} />
        </span>
        <div className="min-w-0">
          <div className="truncate text-xs font-black text-white">{data.label}</div>
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] opacity-70">{data.status}</div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {data.expert && (
          <span className="rounded border border-current/20 px-1.5 py-0.5 text-[9px] font-black uppercase opacity-75">{data.expert}</span>
        )}
        {data.provider && (
          <span className="rounded border border-current/20 px-1.5 py-0.5 text-[9px] font-black uppercase opacity-75">{data.provider}</span>
        )}
        {data.risk && (
          <span className="rounded border border-[#F7C35F]/30 bg-[#F7C35F]/10 px-1.5 py-0.5 text-[9px] font-black uppercase text-[#FFE1A0]">{data.risk}</span>
        )}
      </div>
      {data.summary && (
        <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-white/45">{data.summary}</p>
      )}
      <Handle type="source" position={Position.Right} className="!border-white/30 !bg-[#0D1117]" />
    </div>
  );
}

const nodeTypes = { tool: ToolNode };

function toFlowNodes(nodes = []) {
  return nodes.map((node, index) => ({
    id: node.id,
    type: 'tool',
    position: {
      x: (index % 3) * 250,
      y: Math.floor(index / 3) * 150,
    },
    data: {
      label: node.label,
      status: node.status,
      source: node.source,
      summary: node.summary,
      nodeKind: node.nodeKind,
      expert: node.expert,
      provider: node.provider,
      risk: node.risk,
    },
  }));
}

function toFlowEdges(edges = []) {
  return edges.map((edge) => ({
    ...edge,
    animated: true,
    style: { stroke: '#8DA2FF', strokeWidth: 1.5 },
  }));
}

export default function ToolVisualizer({ toolGraph, experienceMode = 'professional', compact = false }) {
  const nodes = useMemo(() => toFlowNodes(toolGraph?.nodes || []), [toolGraph]);
  const edges = useMemo(() => toFlowEdges(toolGraph?.edges || []), [toolGraph]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden border-b border-white/10 bg-[#0B0E14]/70">
      <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <GitBranch size={16} className="text-[#F7C35F]" />
            <h2 className="text-sm font-black tracking-tight text-white">Tool Graph</h2>
          </div>
          {!compact && (
            <p className="mt-1 text-xs font-medium text-white/40">
              {experienceMode === 'learner' ? 'A guided map of Selina actions' : 'MCP and sandbox execution chain'}
            </p>
          )}
        </div>
        <span className="rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">
          {nodes.length} nodes
        </span>
      </header>

      <div className="min-h-0 flex-1">
        {nodes.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center p-6 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/25">
              <GitBranch size={24} />
            </div>
            <h3 className="text-sm font-black text-white">No tool chain yet</h3>
            <p className="mt-2 max-w-60 text-xs leading-relaxed text-white/40">
              Tool calls, approvals, MCP actions, and sandbox checks will appear as Selina works.
            </p>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.25 }}
            proOptions={{ hideAttribution: true }}
            className="bg-[#080A0F]"
          >
            <Background color="rgba(255,255,255,0.08)" gap={18} />
            <Controls showInteractive={false} />
            {experienceMode === 'professional' && <MiniMap pannable zoomable />}
          </ReactFlow>
        )}
      </div>
    </div>
  );
}
