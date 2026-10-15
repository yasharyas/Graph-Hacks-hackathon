// Thin re-export so web code imports contract types from one short path.
// The types themselves live in shared/events.ts (owned by the orchestrator); never redefine them here.
export type * from '../../../shared/events.ts';
