-- Prisma's bookkeeping table is created outside our migrations; lock it from Supabase's public Data API too.
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
