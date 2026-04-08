export type SourceTrust = 'curated' | 'verified' | 'open';
export type SourceStatus = 'queued' | 'active' | 'probation' | 'disabled' | 'unreachable';
export type DiscoveredFrom = 'awesome-tech-rss' | 'engineering-blogs' | 'both' | 'manual';

export interface ContentSource {
  readonly id: string;
  readonly name: string;
  readonly url: string;
  readonly rss_url: string;
  readonly trust: SourceTrust;
  readonly status: SourceStatus;
  readonly articles_evaluated: number;
  readonly articles_passed: number;
  readonly best_score_30d: number;
  readonly matched_count: number;
  readonly last_matched_at: string | null;
  readonly fetch_failures: number;
  readonly last_fetch_ok_at: string | null;
  readonly added_at: string;
  readonly disabled_at: string | null;
  readonly discovered_from: DiscoveredFrom | null;
  readonly is_protected: boolean;
}

export interface ContentItem {
  readonly id: string;
  readonly source_id: string;
  readonly fetched_at: string;
  readonly week_of: string;
  readonly url: string;
  readonly title: string;
  readonly content_text: string;
  readonly summary: string;
  readonly main_thesis: string;
  readonly key_insights: string[];
  readonly tech_concepts: string[];
  readonly seed_modules: string[] | null;
  readonly quality_score: number;
  readonly times_matched: number;
  readonly title_hash: string;
  readonly fingerprint: string;
}

export interface ArticleText {
  readonly title: string;
  readonly text: string;
  readonly wordCount: number;
  readonly publishedAt: Date | null;
}

export interface ClassifierResult {
  readonly quality_score: number;
  readonly summary: string;
  readonly main_thesis: string;
  readonly key_insights: string[];
  readonly tech_concepts: string[];
}

export interface PipelineRunStats {
  sources_active: number;
  sources_queued: number;
  sources_promoted: number;
  articles_fetched: number;
  articles_extracted: number;
  extraction_failures: number;
  articles_deduped: number;
  articles_preskipped: number;
  articles_structural: number;
  articles_classified: number;
  articles_stored: number;
  chunks_embedded: number;
  avg_quality_score: number | null;
  score_distribution: Record<string, number>;
  commits_with_match: number;
  commits_without_match: number;
  match_skip_failures: number;
  classify_json_errors: number;
  embed_failures: number;
}
