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
    description: 'Makes SURGICAL edits to an existing file using search/replace blocks. Each search string must be an exact unique substring of the file. ALWAYS read the file first before using this tool.',
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
];
