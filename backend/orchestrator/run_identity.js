import { v4 as uuid } from 'uuid';

let globalSequence = 0;

function nextSequence() {
  globalSequence += 1;
  return globalSequence;
}

export function createRootRunIdentity({
  expert = 'manager',
  provider = null,
  model = null,
} = {}) {
  const runId = uuid();
  return {
    rootRunId: runId,
    runId,
    parentRunId: null,
    depth: 0,
    sequence: nextSequence(),
    expert,
    provider,
    model,
  };
}

export function createChildRunIdentity(parentRun, {
  expert = 'code',
  provider = null,
  model = null,
} = {}) {
  const parent = parentRun || createRootRunIdentity();
  return {
    rootRunId: parent.rootRunId || parent.runId,
    runId: uuid(),
    parentRunId: parent.runId || null,
    depth: Number(parent.depth || 0) + 1,
    sequence: nextSequence(),
    expert,
    provider,
    model,
  };
}

export function withRunExpert(runIdentity = {}, {
  expert,
  provider,
  model,
} = {}) {
  return {
    ...runIdentity,
    expert: expert || runIdentity.expert || 'code',
    provider: provider || runIdentity.provider || null,
    model: model || runIdentity.model || null,
  };
}
