
-- Add unique constraint for upsert on conversations
ALTER TABLE public.assistant_conversations ADD CONSTRAINT assistant_conversations_biz_user_unique UNIQUE (business_id, user_id);
