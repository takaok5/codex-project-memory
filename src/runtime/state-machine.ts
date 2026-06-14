import { PmemError } from "../shared/errors.js";
import type { MemoryEvent, MemoryStatus } from "../shared/types.js";

const TRANSITIONS: Partial<Record<MemoryStatus, Partial<Record<MemoryEvent, MemoryStatus>>>> = {
  not_initialized: { init_started: "initializing", init_completed: "fresh", mark_error: "error" },
  initializing: { init_completed: "fresh", mark_error: "error" },
  fresh: { index_started: "stale", mark_dirty: "dirty", render_completed: "fresh", doctor_ok: "fresh", mark_error: "error" },
  stale: { index_completed: "fresh", render_completed: "fresh", mark_dirty: "dirty", mark_error: "error" },
  dirty: { index_started: "stale", index_completed: "fresh", render_completed: "fresh", mark_error: "error" },
  error: { init_started: "initializing", index_started: "stale", mark_dirty: "dirty", doctor_ok: "error", mark_error: "error" }
};

export function transitionMemoryState(current: MemoryStatus, event: MemoryEvent): MemoryStatus {
  const next = TRANSITIONS[current]?.[event];
  if (!next) {
    throw new PmemError("STATE_ERROR", "Invalid memory state transition.", {
      details: { current, event }
    });
  }
  return next;
}
