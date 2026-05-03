import { SchemaType as Type } from '@google/generative-ai';

/**
 * Tool Definitions for Gemini Agents — Brain v3.0
 * Includes: surgical editing, clarification, planning, memory, and grep.
 */
export const AGENT_TOOLS = [
  // === FILE OPERATIONS ===
  {
    name: 'list_files',
    description: 'Lists files and directories in a given path. ALWAYS call this before assuming a file path exists.',
    parameters: {
      type: 'OBJECT',
      properties: {
        path: { type: 'STRING', description: 'The directory path to list (e.g., ".", "./src").' },
      },
      required: ['path'],
    },
  },
  {
    name: 'read_file',
    description: 'Reads the content of a file. MUST be called before any edit_file call. Use start_line/end_line for large files.',
    parameters: {
      type: 'OBJECT',
      properties: {
        path: { type: 'STRING', description: 'Path to the file.' },
        start_line: { type: 'NUMBER', description: 'Optional 1-indexed start line for partial reads.' },
        end_line: { type: 'NUMBER', description: 'Optional 1-indexed end line for partial reads.' },
      },
      required: ['path'],
    },
  },
  {
    name: 'create_file',
    description: 'Creates a NEW file that does not exist yet. DO NOT use this to modify existing files — use edit_file instead.',
    parameters: {
      type: 'OBJECT',
      properties: {
        path: { type: 'STRING', description: 'Path for the new file.' },
        content: { type: 'STRING', description: 'Full content of the new file.' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'edit_file',
    description: 'Makes SURGICAL edits to an existing file using search/replace blocks. Each search string must be an exact unique substring of the file. ALWAYS read the file first before using this tool. NOTE: An automatic Git checkpoint will be created before applying changes.',
    parameters: {
      type: 'OBJECT',
      properties: {
        path: { type: 'STRING', description: 'Path to the file to edit.' },
        edits: {
          type: 'ARRAY',
          description: 'Array of search/replace operations.',
          items: {
            type: 'OBJECT',
            properties: {
              search: { type: 'STRING', description: 'Exact text to find in the file. Must be unique.' },
              replace: { type: 'STRING', description: 'Replacement text.' },
            },
            required: ['search', 'replace'],
          },
        },
      },
      required: ['path', 'edits'],
    },
  },
  
  // === SEARCH ===
  {
    name: 'grep_search',
    description: 'Searches for a text pattern across all files in the project. Returns filenames and matching lines. Use this to find where functions, variables, or patterns are defined or used.',
    parameters: {
      type: 'OBJECT',
      properties: {
        pattern: { type: 'STRING', description: 'The search pattern (string or regex).' },
        file_pattern: { type: 'STRING', description: 'Optional glob filter, e.g., "*.js", "*.jsx".' },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'search_symbols',
    description: 'Finds semantic symbols (functions, classes, variables) across the codebase. More precise than grep for finding definitions.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'Symbol name or partial name.' },
        kind: { type: 'STRING', description: 'Optional filter: "function", "class", or "variable".' },
      },
      required: ['query'],
    },
  },

  // === EXECUTION ===
  {
    name: 'run_command',
    description: 'Runs a terminal command in the WebContainer. Use for npm install, build, test, etc.',
    parameters: {
      type: 'OBJECT',
      properties: {
        command: { type: 'STRING', description: 'The command to execute.' },
        args: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Arguments.' },
      },
      required: ['command'],
    },
  },

  // === GIT ===
  {
    name: 'git_clone',
    description: 'Clones a remote Git repository into the WebContainer.',
    parameters: {
      type: 'OBJECT',
      properties: {
        url: { type: 'STRING', description: 'The HTTPS repository URL.' },
      },
      required: ['url'],
    },
  },

  // === INTELLIGENCE ===
  {
    name: 'ask_clarification',
    description: 'Ask the user specific clarifying questions BEFORE taking action. Use when the request is ambiguous, mentions multiple possible targets, or requires a design decision. Do NOT use for trivial questions.',
    parameters: {
      type: 'OBJECT',
      properties: {
        questions: {
          type: 'ARRAY',
          items: { type: 'STRING' },
          description: 'List of specific questions to ask the user.',
        },
        context: { type: 'STRING', description: 'Brief explanation of why you need clarification.' },
      },
      required: ['questions', 'context'],
    },
  },
  {
    name: 'create_plan',
    description: 'Create a step-by-step plan for a complex task (3+ files). The plan is shown to the user for approval before execution.',
    parameters: {
      type: 'OBJECT',
      properties: {
        steps: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              file: { type: 'STRING', description: 'Target file path.' },
              action: { type: 'STRING', description: 'What will be done to the file.' },
              reason: { type: 'STRING', description: 'Why this change is needed.' },
            },
            required: ['file', 'action'],
          },
        },
        risks: {
          type: 'ARRAY',
          items: { type: 'STRING' },
          description: 'Potential risks or side effects.',
        },
      },
      required: ['steps'],
    },
  },
  {
    name: 'update_memory',
    description: 'Record a learning or pattern discovery to the brain journal for future sessions. Use after debugging breakthroughs, user preference discovery, or architecture insights.',
    parameters: {
      type: 'OBJECT',
      properties: {
        type: { type: 'STRING', description: 'Category: "debug", "preference", "pattern", or "architecture".' },
        content: { type: 'STRING', description: 'The learning to remember.' },
      },
      required: ['type', 'content'],
    },
  },

  // === GITHUB ===
  {
    name: 'github_create_branch',
    description: 'Creates an isolated agent working branch on GitHub using the selina/<timestamp>/<slug> convention. ALWAYS call this before making any file commits on a shared repository.',
    parameters: {
      type: 'OBJECT',
      properties: {
        owner:    { type: 'STRING', description: 'Repository owner (user or org).' },
        repo:     { type: 'STRING', description: 'Repository name.' },
        base:     { type: 'STRING', description: 'Branch to fork from (default: "main").' },
        taskSlug: { type: 'STRING', description: 'Short description of the task, used in the branch name (e.g. "fix-login-bug").' },
      },
      required: ['owner', 'repo'],
    },
  },
  {
    name: 'github_detect_conflicts',
    description: 'Compares the agent branch against the upstream base to detect divergence and overlapping file changes. CALL THIS before opening a PR if other contributors may have pushed commits. If hasRisk is true, halt and ask the user how to resolve before proceeding.',
    parameters: {
      type: 'OBJECT',
      properties: {
        owner:        { type: 'STRING', description: 'Repository owner.' },
        repo:         { type: 'STRING', description: 'Repository name.' },
        agentBranch:  { type: 'STRING', description: 'The agent\'s working branch name.' },
        baseBranch:   { type: 'STRING', description: 'The upstream base branch (default: "main").' },
      },
      required: ['owner', 'repo', 'agentBranch'],
    },
  },
  {
    name: 'github_fetch_upstream',
    description: 'Fetches the latest commit log from the upstream base branch. Use to check what other contributors have pushed before making changes.',
    parameters: {
      type: 'OBJECT',
      properties: {
        owner:  { type: 'STRING', description: 'Repository owner.' },
        repo:   { type: 'STRING', description: 'Repository name.' },
        branch: { type: 'STRING', description: 'Branch to inspect (default: "main").' },
        limit:  { type: 'NUMBER', description: 'Number of commits to fetch (max 30, default 10).' },
      },
      required: ['owner', 'repo'],
    },
  },
  {
    name: 'github_post_comment',
    description: 'Posts a comment on a GitHub Issue or Pull Request. Use to report test results, summarise changes, or ask for review.',
    parameters: {
      type: 'OBJECT',
      properties: {
        owner:        { type: 'STRING', description: 'Repository owner (user or org).' },
        repo:         { type: 'STRING', description: 'Repository name.' },
        issue_number: { type: 'NUMBER', description: 'The PR or Issue number.' },
        body:         { type: 'STRING', description: 'The comment text (Markdown supported).' },
      },
      required: ['owner', 'repo', 'issue_number', 'body'],
    },
  },
  {
    name: 'github_create_pr',
    description: 'Opens a Pull Request. Automatically runs conflict detection — if the agent branch is behind upstream with overlapping changes, the PR will be blocked and the user will be asked to resolve. Use github_detect_conflicts first if in doubt.',
    parameters: {
      type: 'OBJECT',
      properties: {
        owner: { type: 'STRING', description: 'Repository owner.' },
        repo:  { type: 'STRING', description: 'Repository name.' },
        title: { type: 'STRING', description: 'PR title.' },
        body:  { type: 'STRING', description: 'PR description/summary (Markdown).' },
        head:  { type: 'STRING', description: 'The agent branch containing changes.' },
        base:  { type: 'STRING', description: 'Target branch to merge into (default: "main").' },
      },
      required: ['owner', 'repo', 'title', 'head'],
    },
  },
  {
    name: 'github_create_check_run',
    description: 'Creates a GitHub Check Run to report CI/test status on a commit. Use after running tests in the sandbox to mark the PR with pass/fail.',
    parameters: {
      type: 'OBJECT',
      properties: {
        owner:      { type: 'STRING', description: 'Repository owner.' },
        repo:       { type: 'STRING', description: 'Repository name.' },
        name:       { type: 'STRING', description: 'Check name (e.g., "Selina Tests").' },
        head_sha:   { type: 'STRING', description: 'The commit SHA to attach the check to.' },
        status:     { type: 'STRING', enum: ['queued', 'in_progress', 'completed'], description: 'Check status.' },
        conclusion: { type: 'STRING', enum: ['success', 'failure', 'neutral', 'cancelled', 'skipped', 'timed_out'], description: 'Final result (required when status is "completed").' },
        output: {
          type: 'OBJECT',
          description: 'Check output object.',
          properties: {
            title:   { type: 'STRING' },
            summary: { type: 'STRING' },
          },
        },
      },
      required: ['owner', 'repo', 'name', 'head_sha', 'status'],
    },
  },
  {
    name: 'github_create_codespace',
    description: 'Spawns a GitHub Codespace for heavy builds or integration tests that cannot run in the local Docker sandbox.',
    parameters: {
      type: 'OBJECT',
      properties: {
        owner:             { type: 'STRING', description: 'Repository owner.' },
        repo:              { type: 'STRING', description: 'Repository name.' },
        ref:               { type: 'STRING', description: 'Branch or commit SHA.' },
        machine_type_name: { type: 'STRING', description: 'Machine type (e.g., "basicLinux32gb").' },
      },
      required: ['owner', 'repo', 'ref'],
    },
  },
  {
    name: 'delegate_task',
    description: 'Delegates a specific sub-task to a specialist expert. Use this to distribute work across the swarm.',
    parameters: {
      type: 'OBJECT',
      properties: {
        expert: { type: 'STRING', description: 'The expert to call: "code", "ui", "git", "debug", or "security".' },
        task: { type: 'STRING', description: 'The specific task for the expert to perform.' },
        context: { type: 'STRING', description: 'Any relevant file paths or background info.' },
      },
      required: ['expert', 'task'],
    },
  },
  {
    name: 'security_sandbox',
    description: `Executes a script or test file inside a fully isolated Docker sandbox with no network access.
Use this to run LLM-generated code, test suites, or scripts safely without risking the host machine.
The sandbox is ephemeral — it starts, runs the script, streams output, then self-destructs.

WHEN TO USE:
  - Verify that generated code actually runs ("npm test", "node script.js")
  - Run linters or formatters in isolation (eslint, prettier)
  - Execute any script where correctness or safety is uncertain

DO NOT USE for:
  - Commands that require network access (use the VFS + git tools instead)
  - Installing global packages (the sandbox is read-only except /tmp)`,
    parameters: {
      type: 'OBJECT',
      properties: {
        scriptPath: {
          type: 'STRING',
          description: 'Relative path to the script inside the workspace to execute. E.g., "test/run.js" or "scripts/lint.sh".',
        },
        runtime: {
          type: 'STRING',
          enum: ['node', 'sh', 'python3', 'bun'],
          description: 'The interpreter to use. Defaults to "node".',
        },
        workspacePath: {
          type: 'STRING',
          description: 'Absolute host path of the workspace to mount read-only. Defaults to the current project root.',
        },
        timeoutMs: {
          type: 'NUMBER',
          description: 'Maximum execution time in milliseconds (1000–60000). Defaults to 10000. Lower for simple scripts.',
        },
      },
      required: ['scriptPath'],
    },
  },
  {
    name: 'github_trigger_workflow',
    description: 'Triggers a remote GitHub Action workflow.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        owner: { type: Type.STRING },
        repo: { type: Type.STRING },
        workflow_id: { type: Type.STRING },
        ref: { type: Type.STRING }
      },
      required: ['owner', 'repo', 'workflow_id', 'ref'],
    },
  },
  {
    name: 'github_get_codeql_alerts',
    description: 'Fetches CodeQL security alerts for a given repository.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        owner: { type: Type.STRING },
        repo: { type: Type.STRING },
        ref: { type: Type.STRING }
      },
      required: ['owner', 'repo', 'ref'],
    },
  },
  {
    name: 'design_research',
    description: 'Fetch design inspiration, patterns, and moodboard references from specialized repositories.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'The visual concept or component type to research.' },
        source: { type: 'STRING', enum: ['mobbin', 'behance', 'dribbble'], description: 'The inspiration source.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'generate_image',
    description: 'Generates a custom visual asset (illustration, icon, background) based on a creative description.',
    parameters: {
      type: 'OBJECT',
      properties: {
        prompt: { type: 'STRING', description: 'The detailed visual prompt for the generator.' },
        style: { type: 'STRING', description: 'The artistic style (e.g., "minimalist", "3D render").' },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'generate_ui_variant',
    description: 'Requests alternative visual interpretations of a specific UI component.',
    parameters: {
      type: 'OBJECT',
      properties: {
        componentId: { type: 'STRING', description: 'The component to redesign.' },
        selina: { type: 'STRING', description: 'The desired aesthetic shift (e.g., "more brutalist").' },
      },
      required: ['componentId', 'selina'],
    },
  },
];
