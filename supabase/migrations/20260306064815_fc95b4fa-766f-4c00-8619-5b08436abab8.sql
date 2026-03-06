-- Add unique constraint for upsert to work
ALTER TABLE public.assistant_conversations
ADD CONSTRAINT assistant_conversations_user_id_business_id_key UNIQUE (user_id, business_id);