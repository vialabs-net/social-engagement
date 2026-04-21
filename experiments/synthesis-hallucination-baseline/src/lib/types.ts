import type { FileDiff } from '../../../../src/analysis/types.js';

export interface AuthorsConfig {
  included: string[];
  excluded: Array<{ login: string; reason: string }>;
  notes?: string;
}

export interface VoiceProfileCacheEntry {
  tenant_id: string;
  github_author_login: string;
  voice?: unknown;
}

export interface AuthorEmails {
  [login: string]: string[];
}

export interface ResampleManifestEntry {
  repo: string;
  local_path: string;
  head_sha: string;
  head_date: string;
  run_started_at: string;
}

export interface CachedCommit {
  commit_sha: string;
  repo: string;
  author_login: string | null;
  author_email: string | null;
  commit_date: string;
  commit_message: string;
  commit_body: string | null;
  diffs: FileDiff[];
  languages: string[];
  files_count: number;
}

export interface SynthesisGroup {
  id: string;
  author_login: string;
  tenant_id: string | null;
  repo: string;
  topic: string;
  variant: 'FOCAL' | 'ARCO' | 'SINGLE';
  origin: 'organic' | 'adversarial' | 'control';
  coherence_score: number | null;
  commit_shas: string[];
}

export interface HaikuSignalOutput {
  topic: string | null;
  strength: number | null;
  pattern_kind:
    | 'new_abstraction'
    | 'contract_change'
    | 'semantic_refactor'
    | 'config_change'
    | 'dependency_update'
    | 'behavioral_change'
    | null;
  affected_symbols: string[];
  specific_change: string;
  trivial?: boolean;
}

export type StructuralCheck =
  | 'grounded'
  | 'symbol_not_in_diff'
  | 'number_not_in_diff'
  | 'file_not_in_diff'
  | 'frame'
  | 'needs_human';

export type HumanLabel =
  | 'grounded'
  | 'plausible_unsupported'
  | 'contradicted'
  | 'irrelevant'
  | 'frame';

export type PublishReadiness = 'publish_asis' | 'light_edit' | 'rewrite' | 'discard';
export type DeclineJudgment = 'correct' | 'incorrect' | 'ambiguous';
