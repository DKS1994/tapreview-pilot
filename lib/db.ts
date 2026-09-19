import postgres from "postgres";

// Works with any Postgres host. In serverless, use the POOLED connection
// string (e.g. Supabase port 6543, or a Neon pooled endpoint).
//
// prepare: false — required when connecting through Supabase's port-6543
// "Transaction pooler" (PgBouncer in transaction mode): prepared statements
// aren't reliably supported across pooled connections there, and without
// this the client can silently hang for 100+ seconds instead of failing
// fast. connect_timeout/idle_timeout bound how long a broken connection can
// hang before the client gives up and reconnects.
export const sql = postgres(process.env.DATABASE_URL!, {
  max: 1,
  prepare: false,
  connect_timeout: 10,
  idle_timeout: 20,
});
