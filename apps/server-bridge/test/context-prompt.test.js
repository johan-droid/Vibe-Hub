import { describe, expect, it } from 'vitest';
import { PromptOrchestrator } from '../orchestrator/context.js';

describe('PromptOrchestrator AST context pruning', () => {
  it('keeps task-relevant AST entries and removes unrelated dependency noise', () => {
    const astGraph = {
      file: 'src/components/Button.jsx',
      strict_imports: [
        "import React from 'react';",
        "import { ButtonTheme } from './ButtonTheme';",
        "import express from 'express';",
        "import { createServer } from '../server/api';",
        "import { UserRepo } from '../server/UserRepo';",
        "import { ButtonIcon } from './ButtonIcon';",
        "import { BillingJob } from '../jobs/BillingJob';",
        "import { ButtonAnalytics } from './ButtonAnalytics';",
        "import { QueueWorker } from '../server/QueueWorker';",
        "import { ButtonLabel } from './ButtonLabel';",
        "import { ExpressRouter } from '../server/router';",
        "import { ButtonSize } from './ButtonSize';",
        "import { MigrationRunner } from '../server/migrations';",
      ],
      strict_exports: ['export function Button() {}'],
      internal_functions: ['Button', 'renderButtonLabel', 'startExpressServer', 'runMigration'],
      state_context: [
        'hook_state: const [buttonOpen, setButtonOpen] = useState(false);',
        'store_selector: const buttonTheme = useButtonStore(s => s.theme);',
        'exported_variable: const serverPort = process.env.PORT;',
      ],
    };

    const pruned = PromptOrchestrator.pruneAstGraphForTask(astGraph, 'Modify the React Button hover state');

    expect(pruned.strict_imports).toEqual(expect.arrayContaining([
      "import { ButtonTheme } from './ButtonTheme';",
      "import { ButtonIcon } from './ButtonIcon';",
    ]));
    expect(pruned.strict_imports).not.toContain("import express from 'express';");
    expect(pruned.internal_functions).toEqual(expect.arrayContaining(['Button', 'renderButtonLabel']));
    expect(pruned.internal_functions).not.toContain('startExpressServer');
    expect(pruned.state_context).toEqual(expect.arrayContaining([
      'hook_state: const [buttonOpen, setButtonOpen] = useState(false);',
      'store_selector: const buttonTheme = useButtonStore(s => s.theme);',
    ]));
    expect(pruned.state_context).not.toContain('exported_variable: const serverPort = process.env.PORT;');
  });

  it('can build a task prompt without duplicating cached AST context', () => {
    const prompt = PromptOrchestrator.buildTaskPrompt(
      'Update Button styling',
      { file: 'Button.jsx', strict_imports: ['import React from "react";'], strict_exports: [], internal_functions: [] },
      null,
      { includeAstContext: false }
    );

    expect(prompt).toContain('=== [CURRENT TASK] ===');
    expect(prompt).not.toContain('=== [DETERMINISTIC SEMANTIC GRAPH] ===');
  });
});
