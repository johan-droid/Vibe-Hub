export class CommandGuardError extends Error {
  constructor(message, code = 'COMMAND_INPUT_REJECTED') {
    super(message);
    this.name = 'CommandGuardError';
    this.code = code;
  }
}

const COMMAND_PATTERN = /^[a-zA-Z0-9_.:/\\-]+(?:\.cmd|\.exe|\.bat|\.ps1)?$/i;
const SHELL_META_PATTERN = /(?:&&|\|\||[|;`<>]|\$\(|\r|\n)/;
const FORBIDDEN_COMMANDS = new Set(['cmd', 'powershell', 'pwsh', 'sudo', 'su']);

function assertSafeScalar(value, field) {
  if (typeof value !== 'string') {
    throw new CommandGuardError(`${field} must be a string`);
  }
  if (value.includes('\0') || SHELL_META_PATTERN.test(value)) {
    throw new CommandGuardError(`${field} contains shell metacharacters`);
  }
  return value;
}

export function validateCommandInvocation({ command, args = [] } = {}) {
  const safeCommand = assertSafeScalar(command, 'command').trim();
  const commandName = safeCommand.split(/[\\/]/).pop().toLowerCase();

  if (!COMMAND_PATTERN.test(safeCommand) || safeCommand.includes(' ')) {
    throw new CommandGuardError('command must be a single executable name or path; pass arguments separately');
  }
  if (FORBIDDEN_COMMANDS.has(commandName.replace(/\.(cmd|exe|bat|ps1)$/i, ''))) {
    throw new CommandGuardError(`command ${commandName} is not allowed through agent execution`);
  }
  if (!Array.isArray(args)) {
    throw new CommandGuardError('args must be an array');
  }

  const safeArgs = args.map((arg, index) => assertSafeScalar(arg, `args[${index}]`));
  if (['sh', 'bash'].includes(commandName) && safeArgs.includes('-c')) {
    throw new CommandGuardError('shell -c is not allowed; pass an executable and args directly');
  }
  return { command: safeCommand, args: safeArgs };
}

export function validateMcpProcessInvocation(command, args = []) {
  return validateCommandInvocation({ command, args });
}
