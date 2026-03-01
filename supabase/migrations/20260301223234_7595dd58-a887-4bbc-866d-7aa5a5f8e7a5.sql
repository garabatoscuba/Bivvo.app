
-- Global assistant configuration (singleton row)
CREATE TABLE public.assistant_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tone text NOT NULL DEFAULT 'friendly' CHECK (tone IN ('formal', 'friendly', 'technical')),
  is_enabled boolean NOT NULL DEFAULT true,
  base_instructions text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Insert default row
INSERT INTO public.assistant_config (tone, is_enabled, base_instructions)
VALUES ('friendly', true, '');

-- Instructions per business type
CREATE TABLE public.assistant_business_type_instructions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_type text NOT NULL UNIQUE,
  instructions text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed default rows
INSERT INTO public.assistant_business_type_instructions (business_type, instructions)
VALUES ('store', ''), ('copy_shop', ''), ('gym', '');

-- Training examples (Q&A pairs)
CREATE TABLE public.assistant_training_examples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Conversation history
CREATE TABLE public.assistant_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  user_role text NOT NULL DEFAULT 'viewer',
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_assistant_conversations_business ON public.assistant_conversations(business_id);
CREATE INDEX idx_assistant_conversations_user ON public.assistant_conversations(user_id);

-- RLS
ALTER TABLE public.assistant_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_business_type_instructions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_training_examples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_conversations ENABLE ROW LEVEL SECURITY;

-- Super admin full access policies
CREATE POLICY "super_admin_all_assistant_config" ON public.assistant_config
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "super_admin_all_bt_instructions" ON public.assistant_business_type_instructions
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "super_admin_all_training_examples" ON public.assistant_training_examples
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "super_admin_all_conversations" ON public.assistant_conversations
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Read-only for edge function (service role handles this)
-- Users can read config for the assistant to work
CREATE POLICY "anyone_read_assistant_config" ON public.assistant_config
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "anyone_read_bt_instructions" ON public.assistant_business_type_instructions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "anyone_read_training_examples" ON public.assistant_training_examples
  FOR SELECT TO authenticated USING (true);

-- Users can insert/update their own conversations
CREATE POLICY "users_manage_own_conversations" ON public.assistant_conversations
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Updated_at triggers
CREATE TRIGGER update_assistant_config_updated_at BEFORE UPDATE ON public.assistant_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bt_instructions_updated_at BEFORE UPDATE ON public.assistant_business_type_instructions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_training_examples_updated_at BEFORE UPDATE ON public.assistant_training_examples FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON public.assistant_conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
