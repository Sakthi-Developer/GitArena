/**
 * Terminal component with command history, autocomplete, and rich output.
 * Keyboard-first: Tab for autocomplete, Up/Down for history.
 */
import React, { memo, useRef, useState, useCallback, useEffect } from 'react';
import { useAppStore, selectHistory, selectEngineReady } from '../state/useAppStore';
import { executeCommand, getCompletions } from '../lib/commandParser';
import { getEngine } from '../lib/gitEngine';
import type { CommandResult, HistoryEntry } from '../lib/types';

interface TerminalProps {
  onCommandExecuted?: () => void;
}

export const Terminal = memo(function Terminal({ onCommandExecuted }: TerminalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [autocomplete, setAutocomplete] = useState<string[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const engineReady = useAppStore(selectEngineReady);
  const [autocompleteIdx, setAutocompleteIdx] = useState(0);

  const history = useAppStore(selectHistory);
  const addHistory = useAppStore((s) => s.addHistory);
  const clearHistory = useAppStore((s) => s.clearHistory);
  const incrementCommandCount = useAppStore((s) => s.incrementCommandCount);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  // Focus input on click
  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const refreshGraph = useCallback(async () => {
    const engine = getEngine();
    if (!engine.initialized) return;
    try {
      const commits = await engine.allCommits();
      const branch = await engine.currentBranch();
      const branches = await engine.listBranches();
      useAppStore.getState().setCommits(commits);
      useAppStore.getState().setCurrentBranch(branch);
      useAppStore.getState().setBranches(branches);
    } catch {
      // Engine error — swallow
    }
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = input.trim();
      if (!trimmed || isExecuting) return;

      setInput('');
      setHistoryIndex(-1);
      setAutocomplete([]);
      setIsExecuting(true);

      const result = await executeCommand(trimmed);
      setIsExecuting(false);

      if (result.output === '__CLEAR__') {
        clearHistory();
        return;
      }

      const entry: HistoryEntry = {
        command: trimmed,
        result,
        timestamp: Date.now(),
      };

      addHistory(entry);
      incrementCommandCount();
      await refreshGraph();
      onCommandExecuted?.();
    },
    [input, isExecuting, addHistory, clearHistory, incrementCommandCount, refreshGraph, onCommandExecuted],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Tab — autocomplete
      if (e.key === 'Tab') {
        e.preventDefault();
        const completions = getCompletions(input);
        if (completions.length === 1) {
          setInput(completions[0]);
          setAutocomplete([]);
        } else if (completions.length > 1) {
          setAutocomplete(completions);
          const nextIdx = (autocompleteIdx + 1) % completions.length;
          setAutocompleteIdx(nextIdx);
          setInput(completions[nextIdx]);
        }
        return;
      }

      // Up — history navigation
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const commandHistory = history.map((h) => h.command);
        if (commandHistory.length === 0) return;
        const nextIdx = historyIndex < commandHistory.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(nextIdx);
        setInput(commandHistory[commandHistory.length - 1 - nextIdx]);
        return;
      }

      // Down — history navigation
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyIndex <= 0) {
          setHistoryIndex(-1);
          setInput('');
          return;
        }
        const nextIdx = historyIndex - 1;
        setHistoryIndex(nextIdx);
        const commandHistory = history.map((h) => h.command);
        setInput(commandHistory[commandHistory.length - 1 - nextIdx]);
        return;
      }

      // Clear autocomplete on other keys
      if (autocomplete.length > 0) {
        setAutocomplete([]);
        setAutocompleteIdx(0);
      }
    },
    [input, history, historyIndex, autocomplete, autocompleteIdx],
  );

  const resultColorClass = (result: CommandResult): string => {
    switch (result.type) {
      case 'success':
        return 'text-arena-success';
      case 'error':
        return 'text-arena-error';
      case 'warning':
        return 'text-arena-warning';
      default:
        return 'text-arena-textMuted';
    }
  };

  return (
    <div
      className="flex flex-col h-full bg-arena-bg border-t border-arena-border"
      onClick={focusInput}
      role="region"
      aria-label="Terminal"
    >
      {/* Output area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-2 py-1.5 font-mono text-sm space-y-0.5"
        aria-live="polite"
        aria-atomic="false"
      >
        {/* Loading / Welcome message */}
        {!engineReady && (
          <div className="text-arena-textDim py-1 flex items-center gap-1">
            <div className="w-[12px] h-[12px] border-2 border-arena-accent border-t-transparent rounded-full animate-spin" />
            Initializing repository...
          </div>
        )}
        {engineReady && history.length === 0 && (
          <div className="text-arena-textDim py-1">
            Welcome to GitArena! Type <span className="text-arena-accent">help</span> for available commands.
          </div>
        )}

        {history.map((entry, i) => (
          <div key={i} className="animate-fade-in">
            <div className="flex items-center gap-1">
              <span className="text-arena-accent select-none">$</span>
              <span className="text-arena-text">{entry.command}</span>
            </div>
            {entry.result.output && (
              <pre
                className={`whitespace-pre-wrap pl-2 text-[13px] leading-relaxed ${resultColorClass(entry.result)}`}
              >
                {entry.result.output}
              </pre>
            )}
          </div>
        ))}
      </div>

      {/* Input area */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center px-2 py-1 border-t border-arena-border/50 bg-arena-surface/30"
      >
        <span className="text-arena-accent mr-1 select-none font-mono text-sm" aria-hidden="true">
          $
        </span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="terminal-input"
          placeholder={engineReady ? 'Type a git command...' : 'Initializing...'}
          disabled={!engineReady || isExecuting}
          autoComplete="off"
          spellCheck={false}
          aria-label="Git command input"
          autoFocus
        />
      </form>

      {/* Autocomplete dropdown */}
      {autocomplete.length > 1 && (
        <div
          className="absolute bottom-[40px] left-2 bg-arena-surface border border-arena-border rounded-lg shadow-lg py-0.5 z-50 max-w-[300px]"
          role="listbox"
          aria-label="Autocomplete suggestions"
        >
          {autocomplete.map((item, i) => (
            <div
              key={item}
              className={`px-2 py-0.5 text-sm font-mono cursor-pointer ${
                i === autocompleteIdx
                  ? 'bg-arena-accent/15 text-arena-accent'
                  : 'text-arena-textMuted hover:bg-arena-surfaceHover'
              }`}
              role="option"
              aria-selected={i === autocompleteIdx}
              onClick={() => {
                setInput(item);
                setAutocomplete([]);
                inputRef.current?.focus();
              }}
            >
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
