Summary of the 3+1 problems:

Problem	Impact	Difficulty
Modules too narrow — no "general engineering" detection	System produces ~0 posts	Medium (new module + lower thresholds)
events_state not in Supabase	Wasted API calls every run	Easy (2 methods in SupabaseStorage)
No in-memory SHA dedup	Same commit enriched N times per run	Easy (add a Set<string>)
Voice not converging	Drafts don't sound like you	Medium (verify voice examples flow, token budget, bootstrap storage)