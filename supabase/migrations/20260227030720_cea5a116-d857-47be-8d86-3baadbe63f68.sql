
-- Add base_currency to businesses
ALTER TABLE public.businesses
ADD COLUMN IF NOT EXISTS base_currency text NOT NULL DEFAULT 'USD';

-- Add onboarding_completed to profiles to track multi-step onboarding
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;
