-- The broadcast server action uses this category when it creates one private
-- conversation per parent. Keep it in the referenced category table first.
INSERT INTO public.message_categories (id, name, description)
VALUES ('broadcast', 'Diffusion', 'Message de diffusion envoyé séparément à chaque parent.')
ON CONFLICT (id) DO NOTHING;