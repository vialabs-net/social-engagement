-- Verification for 2026-04-10 Phase 3 + progressive voice migration

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('voice_profiles', 'voice_posts')
ORDER BY table_name;

SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'voice_posts'
  AND column_name IN (
    'tenant_id',
    'top_module_id',
    'author_login',
    'edit_analysis',
    'context_status',
    'has_industry_context',
    'matched_article_id',
    'matched_source_id',
    'match_strength',
    'match_connection',
    'linkedin_urn',
    'reactions_count',
    'engagement_score',
    'last_reactions_fetch_at',
    'publish_source',
    'generation_system',
    'opening_move'
  )
ORDER BY column_name;

SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'voice_profiles'
  AND column_name IN (
    'tenant_id',
    'github_author_login',
    'voice',
    'version',
    'created_at',
    'updated_at'
  )
ORDER BY column_name;

SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_voice_profiles_tenant_default',
    'idx_voice_profiles_tenant_author',
    'idx_voice_profiles_tenant',
    'idx_voice_posts_tenant',
    'idx_voice_retrieval'
  )
ORDER BY indexname;
