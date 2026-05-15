import { describe, expect, it, vi } from 'vitest';

const gitCalls = vi.hoisted(() => []);

vi.mock('child_process', () => ({
  execFile: vi.fn((_bin, args, _options, callback) => {
    gitCalls.push(args);
    const command = args.join(' ');
    if (command === 'rev-parse --show-toplevel') return callback(null, { stdout: 'D:/Vibe Hub\n' });
    if (command === 'write-tree') return callback(null, { stdout: 'tree-sha\n' });
    if (command === 'rev-parse --verify HEAD') return callback(null, { stdout: 'head-sha\n' });
    if (args[0] === 'commit-tree') return callback(null, { stdout: 'checkpoint-sha\n' });
    return callback(null, { stdout: '' });
  }),
}));

const {
  ExecutionNode,
  GitCheckpointStore,
  RollbackSystem,
} = await import('../orchestrator/state-machine.js');

describe('state-machine DAG Git rollback checkpoints', () => {
  it('stores checkpoint refs instead of full file-content snapshots', async () => {
    gitCalls.length = 0;
    const node = new ExecutionNode({
      action: { name: 'edit_file', args: { path: 'src/App.jsx' } },
    });

    expect(node.codeSnapshot).toBeUndefined();

    const store = new GitCheckpointStore({ workDir: process.cwd() });
    const checkpoint = await store.createCheckpoint(node.id);

    expect(checkpoint).toEqual({
      ref: `refs/selina/checkpoints/${node.id}`,
      commit: 'checkpoint-sha',
    });
    expect(gitCalls).toContainEqual(['add', '-A', '--', '.']);
    expect(gitCalls).toContainEqual(['update-ref', `refs/selina/checkpoints/${node.id}`, 'checkpoint-sha']);
  });

  it('rolls back by resetting to the parent checkpoint ref', async () => {
    const parent = new ExecutionNode({
      action: { name: 'parent', args: {} },
      checkpointRef: 'refs/selina/checkpoints/parent-node',
    });
    const child = new ExecutionNode({
      parentId: parent.id,
      action: { name: 'child', args: {} },
    });
    child.verification.attempts = child.verification.maxAttempts;

    const restoreCheckpoint = vi.fn(async () => ({ restored: true }));
    const rollbackSystem = new RollbackSystem(restoreCheckpoint);
    rollbackSystem.registerNode(parent);
    rollbackSystem.registerNode(child);

    const result = await rollbackSystem.rollback(child.id);

    expect(result.success).toBe(true);
    expect(result.targetNode).toBe(parent);
    expect(restoreCheckpoint).toHaveBeenCalledWith('refs/selina/checkpoints/parent-node');
  });

  it('refuses to reset arbitrary git refs', async () => {
    const store = new GitCheckpointStore({ workDir: process.cwd() });
    await expect(store.restoreCheckpoint('main')).rejects.toThrow('unscoped Selina checkpoint');
  });
});
