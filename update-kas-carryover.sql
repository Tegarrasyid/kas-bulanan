-- =====================================================
-- UPDATE SISTEM KAS: SISA LEBIH BAYAR OTOMATIS KE BULAN DEPAN
-- Jalankan sekali di Supabase SQL Editor.
-- =====================================================

ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS carryover_amount numeric(12,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.payments.carryover_amount IS
'Nominal sisa kas dari bulan sebelumnya yang otomatis dihitung pada bulan ini.';

CREATE INDEX IF NOT EXISTS payments_user_member_month_idx
ON public.payments (user_id, member_id, month);
