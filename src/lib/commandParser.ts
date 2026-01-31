/**
 * Deterministic state-machine command parser for git commands.
 * Parse time: O(n) where n = input length.
 */
import type { ParsedCommand, CommandResult } from './types';
import { GitEngine, getEngine } from './gitEngine';

// ─── Parser (Linear-time state machine) ─────────────────────────────────────

const enum ParseState {
  Start,
  Word,
  QuotedSingle,
  QuotedDouble,
  Flag,
  FlagValue,
}

/**
 * Tokenize input string into tokens.
 * State machine with O(n) transitions where n = input length.
 */
export function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let state: ParseState = ParseState.Start;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    switch (state) {
      case ParseState.Start:
        if (ch === ' ' || ch === '\t') continue;
        if (ch === "'") {
          state = ParseState.QuotedSingle;
          current = '';
        } else if (ch === '"') {
          state = ParseState.QuotedDouble;
          current = '';
        } else {
          state = ParseState.Word;
          current = ch;
        }
        break;

      case ParseState.Word:
        if (ch === ' ' || ch === '\t') {
          tokens.push(current);
          current = '';
          state = ParseState.Start;
        } else {
          current += ch;
        }
        break;

      case ParseState.QuotedSingle:
        if (ch === "'") {
          tokens.push(current);
          current = '';
          state = ParseState.Start;
        } else {
          current += ch;
        }
        break;

      case ParseState.QuotedDouble:
        if (ch === '"') {
          tokens.push(current);
          current = '';
          state = ParseState.Start;
        } else {
          current += ch;
        }
        break;

      default:
        current += ch;
    }
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
}

/**
 * Parse tokens into a structured command.
 * O(t) where t = number of tokens.
 */
export function parseCommand(input: string): ParsedCommand | null {
  const tokens = tokenize(input.trim());
  if (tokens.length === 0) return null;

  // Must start with "git"
  if (tokens[0] !== 'git') {
    return null;
  }

  if (tokens.length < 2) {
    return { base: 'git', subcommand: '', args: [], flags: {} };
  }

  const subcommand = tokens[1];
  const args: string[] = [];
  const flags: Record<string, string | boolean> = {};

  // Short flags that are always boolean (no value argument)
  const booleanShortFlags = new Set(['b', 'd', 'D', 'f', 'v', 'q']);

  for (let i = 2; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok.startsWith('--')) {
      const eqIdx = tok.indexOf('=');
      if (eqIdx > -1) {
        let val = tok.slice(eqIdx + 1);
        // Strip wrapping quotes
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        flags[tok.slice(2, eqIdx)] = val;
      } else {
        // Check if next token is a value
        if (i + 1 < tokens.length && !tokens[i + 1].startsWith('-')) {
          flags[tok.slice(2)] = tokens[i + 1];
          i++;
        } else {
          flags[tok.slice(2)] = true;
        }
      }
    } else if (tok.startsWith('-') && tok.length === 2) {
      const flagName = tok.slice(1);
      // Boolean-only flags
      if (booleanShortFlags.has(flagName)) {
        flags[flagName] = true;
      } else if (i + 1 < tokens.length && !tokens[i + 1].startsWith('-')) {
        flags[flagName] = tokens[i + 1];
        i++;
      } else {
        flags[flagName] = true;
      }
    } else {
      args.push(tok);
    }
  }

  return { base: 'git', subcommand, args, flags };
}

// ─── Command Executor ───────────────────────────────────────────────────────

const SUPPORTED_COMMANDS = [
  'commit',
  'branch',
  'checkout',
  'merge',
  'rebase',
  'reset',
  'log',
  'status',
  'help',
] as const;

type SupportedCommand = (typeof SUPPORTED_COMMANDS)[number];

/**
 * Execute a parsed git command against the engine.
 * O(1) dispatch + O(operation) for each git operation.
 */
export async function executeCommand(
  input: string,
  engine?: GitEngine,
): Promise<CommandResult> {
  const trimmed = input.trim();
  if (!trimmed) {
    return { success: true, output: '', type: 'info' };
  }

  // Handle clear command
  if (trimmed === 'clear') {
    return { success: true, output: '__CLEAR__', type: 'info' };
  }

  // Handle help
  if (trimmed === 'help' || trimmed === 'git help') {
    return {
      success: true,
      output: getHelpText(),
      type: 'info',
    };
  }

  const parsed = parseCommand(trimmed);

  if (!parsed) {
    return {
      success: false,
      output: `Unknown command: "${trimmed}". Type "help" for available commands.`,
      type: 'error',
    };
  }

  if (!parsed.subcommand) {
    return {
      success: false,
      output: 'Usage: git <command> [args]\nType "git help" for available commands.',
      type: 'error',
    };
  }

  if (!SUPPORTED_COMMANDS.includes(parsed.subcommand as SupportedCommand)) {
    return {
      success: false,
      output: `git: "${parsed.subcommand}" is not a supported command.\nSupported: ${SUPPORTED_COMMANDS.join(', ')}`,
      type: 'error',
    };
  }

  const git = engine ?? getEngine();

  // Ensure the engine is initialized before running any git operation
  await git.ensureInitialized();

  try {
    switch (parsed.subcommand as SupportedCommand) {
      case 'commit':
        return await execCommit(git, parsed);
      case 'branch':
        return await execBranch(git, parsed);
      case 'checkout':
        return await execCheckout(git, parsed);
      case 'merge':
        return await execMerge(git, parsed);
      case 'rebase':
        return await execRebase(git, parsed);
      case 'reset':
        return await execReset(git, parsed);
      case 'log':
        return await execLog(git);
      case 'status':
        return await execStatus(git);
      case 'help':
        return { success: true, output: getHelpText(), type: 'info' };
      default:
        return {
          success: false,
          output: `Unhandled command: ${parsed.subcommand}`,
          type: 'error',
        };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, output: `Error: ${message}`, type: 'error' };
  }
}

// ─── Individual Command Handlers ────────────────────────────────────────────

async function execCommit(
  git: GitEngine,
  cmd: ParsedCommand,
): Promise<CommandResult> {
  const message =
    (cmd.flags['m'] as string) ??
    (cmd.flags['message'] as string) ??
    cmd.args[0] ??
    `commit ${Date.now().toString(36)}`;

  const oid = await git.commit(message);
  return {
    success: true,
    output: `[${await git.currentBranch()} ${oid.slice(0, 7)}] ${message}`,
    type: 'success',
  };
}

async function execBranch(
  git: GitEngine,
  cmd: ParsedCommand,
): Promise<CommandResult> {
  if (cmd.flags['d'] || cmd.flags['D'] || cmd.flags['delete']) {
    const name = cmd.args[0];
    if (!name) return { success: false, output: 'Usage: git branch -d <name>', type: 'error' };
    await git.deleteBranch(name);
    return { success: true, output: `Deleted branch ${name}`, type: 'success' };
  }

  if (cmd.args.length === 0) {
    const branches = await git.listBranches();
    const current = await git.currentBranch();
    const output = branches
      .map((b) => (b === current ? `* ${b}` : `  ${b}`))
      .join('\n');
    return { success: true, output, type: 'info' };
  }

  await git.branch(cmd.args[0]);
  return {
    success: true,
    output: `Created branch "${cmd.args[0]}"`,
    type: 'success',
  };
}

async function execCheckout(
  git: GitEngine,
  cmd: ParsedCommand,
): Promise<CommandResult> {
  if (cmd.flags['b'] && cmd.args[0]) {
    await git.branch(cmd.args[0]);
    await git.checkout(cmd.args[0]);
    return {
      success: true,
      output: `Switched to a new branch "${cmd.args[0]}"`,
      type: 'success',
    };
  }

  if (cmd.args.length === 0) {
    return {
      success: false,
      output: 'Usage: git checkout <branch|commit>',
      type: 'error',
    };
  }

  await git.checkout(cmd.args[0]);
  return {
    success: true,
    output: `Switched to "${cmd.args[0]}"`,
    type: 'success',
  };
}

async function execMerge(
  git: GitEngine,
  cmd: ParsedCommand,
): Promise<CommandResult> {
  if (cmd.args.length === 0) {
    return {
      success: false,
      output: 'Usage: git merge <branch>',
      type: 'error',
    };
  }

  const oid = await git.merge(cmd.args[0]);
  return {
    success: true,
    output: `Merged "${cmd.args[0]}" into "${await git.currentBranch()}" → ${oid.slice(0, 7)}`,
    type: 'success',
  };
}

async function execRebase(
  git: GitEngine,
  cmd: ParsedCommand,
): Promise<CommandResult> {
  if (cmd.args.length === 0) {
    return {
      success: false,
      output: 'Usage: git rebase <branch>',
      type: 'error',
    };
  }

  await git.rebase(cmd.args[0]);
  return {
    success: true,
    output: `Rebased "${await git.currentBranch()}" onto "${cmd.args[0]}"`,
    type: 'success',
  };
}

async function execReset(
  git: GitEngine,
  cmd: ParsedCommand,
): Promise<CommandResult> {
  if (!cmd.flags['hard']) {
    return {
      success: false,
      output: 'Only "git reset --hard <ref>" is supported.',
      type: 'error',
    };
  }

  const ref = cmd.args[0] ?? 'HEAD~1';
  await git.resetHard(ref);
  return {
    success: true,
    output: `HEAD is now at ${ref}`,
    type: 'success',
  };
}

async function execLog(git: GitEngine): Promise<CommandResult> {
  const log = await git.log(undefined, 10);
  if (log.length === 0) {
    return { success: true, output: 'No commits yet.', type: 'info' };
  }

  const output = log
    .map((c) => {
      const refs = c.refs.length > 0 ? ` (${c.refs.join(', ')})` : '';
      const head = c.isHead ? ' <- HEAD' : '';
      return `${c.oid.slice(0, 7)}${refs}${head} ${c.message}`;
    })
    .join('\n');

  return { success: true, output, type: 'info' };
}

async function execStatus(git: GitEngine): Promise<CommandResult> {
  const branch = await git.currentBranch();
  return {
    success: true,
    output: `On branch ${branch}\nnothing to commit, working tree clean`,
    type: 'info',
  };
}

// ─── Help Text ──────────────────────────────────────────────────────────────

function getHelpText(): string {
  return `Available commands:
  git commit -m "<message>"    Create a new commit
  git branch [<name>]          List or create branches
  git branch -d <name>         Delete a branch
  git checkout <ref>           Switch to branch or commit
  git checkout -b <name>       Create and switch to new branch
  git merge <branch>           Merge branch into current
  git rebase <branch>          Rebase current onto branch
  git reset --hard <ref>       Reset to a specific commit
  git log                      Show commit history
  git status                   Show current branch
  help                         Show this help message
  clear                        Clear terminal`;
}

// ─── Autocomplete ───────────────────────────────────────────────────────────

const COMMAND_COMPLETIONS = [
  'git commit -m ""',
  'git branch',
  'git branch -d',
  'git checkout',
  'git checkout -b',
  'git merge',
  'git rebase',
  'git reset --hard',
  'git log',
  'git status',
  'help',
  'clear',
];

/**
 * Get autocomplete suggestions for partial input.
 * O(k) where k = number of possible completions.
 */
export function getCompletions(partial: string): string[] {
  if (!partial) return [];
  const lower = partial.toLowerCase();
  return COMMAND_COMPLETIONS.filter((c) =>
    c.toLowerCase().startsWith(lower),
  );
}
