import { describe, it, expect } from 'vitest';
import { tokenize, parseCommand, getCompletions } from '../lib/commandParser';

describe('tokenize', () => {
  it('splits simple words', () => {
    expect(tokenize('git commit')).toEqual(['git', 'commit']);
  });

  it('handles quoted strings', () => {
    expect(tokenize('git commit -m "hello world"')).toEqual([
      'git',
      'commit',
      '-m',
      'hello world',
    ]);
  });

  it('handles single-quoted strings', () => {
    expect(tokenize("git commit -m 'fix bug'")).toEqual([
      'git',
      'commit',
      '-m',
      'fix bug',
    ]);
  });

  it('handles extra whitespace', () => {
    expect(tokenize('  git   branch   feature ')).toEqual([
      'git',
      'branch',
      'feature',
    ]);
  });

  it('returns empty for empty input', () => {
    expect(tokenize('')).toEqual([]);
  });
});

describe('parseCommand', () => {
  it('parses git commit with message flag', () => {
    const cmd = parseCommand('git commit -m "add feature"');
    expect(cmd).not.toBeNull();
    expect(cmd!.base).toBe('git');
    expect(cmd!.subcommand).toBe('commit');
    expect(cmd!.flags['m']).toBe('add feature');
  });

  it('parses git branch with name', () => {
    const cmd = parseCommand('git branch feature');
    expect(cmd).not.toBeNull();
    expect(cmd!.subcommand).toBe('branch');
    expect(cmd!.args).toEqual(['feature']);
  });

  it('parses git checkout -b', () => {
    const cmd = parseCommand('git checkout -b new-branch');
    expect(cmd).not.toBeNull();
    expect(cmd!.subcommand).toBe('checkout');
    expect(cmd!.flags['b']).toBe(true);
    expect(cmd!.args).toEqual(['new-branch']);
  });

  it('parses git reset --hard', () => {
    const cmd = parseCommand('git reset --hard HEAD~1');
    expect(cmd).not.toBeNull();
    expect(cmd!.subcommand).toBe('reset');
    expect(cmd!.flags['hard']).toBe('HEAD~1');
  });

  it('returns null for non-git commands', () => {
    expect(parseCommand('ls -la')).toBeNull();
  });

  it('parses bare git', () => {
    const cmd = parseCommand('git');
    expect(cmd).not.toBeNull();
    expect(cmd!.subcommand).toBe('');
  });

  it('parses long flags with equals', () => {
    const cmd = parseCommand('git commit --message="hello"');
    expect(cmd).not.toBeNull();
    expect(cmd!.flags['message']).toBe('hello');
  });
});

describe('getCompletions', () => {
  it('returns completions for partial input', () => {
    const completions = getCompletions('git c');
    expect(completions.length).toBeGreaterThan(0);
    expect(completions.every((c) => c.startsWith('git c'))).toBe(true);
  });

  it('returns empty for no match', () => {
    expect(getCompletions('xyz')).toEqual([]);
  });

  it('returns empty for empty input', () => {
    expect(getCompletions('')).toEqual([]);
  });

  it('matches case-insensitively', () => {
    const completions = getCompletions('GIT');
    expect(completions.length).toBeGreaterThan(0);
  });
});
