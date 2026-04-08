-- Post-migration verification for Phase 2 + seed corpus readiness

-- 1. voice_posts match metadata columns exist
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'voice_posts'
  AND column_name IN (
    'top_module_id',
    'edit_analysis',
    'context_status',
    'has_industry_context',
    'matched_article_id',
    'matched_source_id',
    'match_strength',
    'match_connection',
    'last_reactions_fetch_at',
    'publish_source',
    'author_login'
  )
ORDER BY column_name;

-- 2. content corpus support columns exist
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'content_sources' AND column_name = 'is_protected')
    OR
    (table_name = 'content_items' AND column_name = 'seed_modules')
  )
ORDER BY table_name, column_name;

-- 3. job_queue / pending_batch / pipeline-run gaps exist
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'job_queue' AND column_name IN ('leased_until', 'idempotency_key'))
    OR
    (table_name = 'pending_batch' AND column_name IN ('tenant_id', 'author_login'))
    OR
    (table_name = 'content_pipeline_runs' AND column_name IN ('classify_batch_id', 'embed_batch_id'))
    OR
    (table_name = 'tenants' AND column_name = 'encrypted_dek')
  )
ORDER BY table_name, column_name;

-- 4. unique partial index for idempotency_key exists
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname = 'idx_job_queue_idempotency';

-- 5. matcher function exists with protected-source clause
SELECT pg_get_functiondef('match_article_chunks(vector,double precision,integer,integer,date)'::regprocedure);
