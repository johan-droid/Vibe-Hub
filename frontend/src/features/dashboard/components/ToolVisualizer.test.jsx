import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ToolVisualizer from './ToolVisualizer.jsx';

vi.mock('@xyflow/react', () => ({
  Background: () => <div data-testid="flow-background" />,
  Controls: () => <div data-testid="flow-controls" />,
  MiniMap: () => <div data-testid="flow-minimap" />,
  ReactFlow: ({ nodes, children }) => (
    <div data-testid="react-flow">
      {nodes.map(node => <div key={node.id}>{node.data.label}</div>)}
      {children}
    </div>
  ),
  ReactFlowProvider: ({ children }) => <div data-testid="react-flow-provider">{children}</div>,
  Handle: () => null,
  Position: { Left: 'left', Right: 'right' },
}));

describe('ToolVisualizer', () => {
  it('renders run hierarchy and risk metadata', () => {
    render(
      <ToolVisualizer
        toolGraph={{
          nodes: [{
            id: 'run:1',
            label: 'manager run',
            status: 'info',
            nodeKind: 'run',
            expert: 'manager',
            provider: 'openai',
          }, {
            id: 'tool:1',
            label: 'selina_a11y__scan',
            status: 'started',
            source: 'mcp',
            risk: 'readonly',
          }],
          edges: [{ id: 'run:1->tool:1', source: 'run:1', target: 'tool:1' }],
        }}
      />
    );

    expect(screen.getByText('manager run')).toBeInTheDocument();
    expect(screen.getByText('selina_a11y__scan')).toBeInTheDocument();
  });
});
