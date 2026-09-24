-- Cleanup unused audit table and RPC for completion reversals
drop table if exists public.completion_reversals cascade;
drop function if exists public.reverse_completion(uuid, text);
drop function if exists private.reverse_completion(uuid, text);
