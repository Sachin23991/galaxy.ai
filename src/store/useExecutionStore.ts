/**
 * Tracks which nodes are currently executing and what they produced.
 * Drives the pulsating glow + inline result render.
 */
"use client";

import { create } from "zustand";

interface ExecutionState {
  running: Record<string, true>;
  results: Record<string, unknown>;
  errors: Record<string, string>;
  startNode(id: string): void;
  finishNode(id: string, output: unknown): void;
  failNode(id: string, err: string): void;
  clearNode(id: string): void;
  isRunning(id: string): boolean;
  reset(): void;
}

export const useExecutionStore = create<ExecutionState>((set, get) => ({
  running: {},
  results: {},
  errors: {},
  startNode(id) {
    set((s) => ({
      running: { ...s.running, [id]: true },
      errors: { ...s.errors, [id]: "" },
    }));
  },
  finishNode(id, output) {
    set((s) => {
      return {
        running: withoutKey(s.running, id),
        results: { ...s.results, [id]: output },
      };
    });
  },
  failNode(id, err) {
    set((s) => {
      return {
        running: withoutKey(s.running, id),
        errors: { ...s.errors, [id]: err },
      };
    });
  },
  clearNode(id) {
    set((s) => {
      return {
        running: withoutKey(s.running, id),
        errors: withoutKey(s.errors, id),
        results: withoutKey(s.results, id),
      };
    });
  },
  isRunning(id) {
    return !!get().running[id];
  },
  reset() {
    set({ running: {}, results: {}, errors: {} });
  },
}));

function withoutKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  const next = { ...record };
  delete next[key];
  return next;
}
