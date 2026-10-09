/**
 * Local PostgreSQL for development/tests without Docker or Supabase.
 * Runs PGlite (Postgres compiled to WASM) behind a Postgres wire-protocol socket.
 *
 *   npm run test:db            → in-memory database on port 5433
 *   PGLITE_DIR=.pglite npm run test:db   → persisted to ./.pglite
 *
 * Connect with: postgresql://postgres:postgres@localhost:5433/postgres?sslmode=disable&pgbouncer=true&connection_limit=1
 */
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

async function main() {
  const port = Number(process.env.PGLITE_PORT ?? 5433);
  const db = await PGlite.create(process.env.PGLITE_DIR || undefined);
  // The multiplexer lets the API, migrations and tests connect at the same time
  const server = new PGLiteSocketServer({ db, port, host: '127.0.0.1', maxConnections: 20 });
  await server.start();
  console.info(`PGlite listening on postgresql://postgres:postgres@127.0.0.1:${port}/postgres`);

  const stop = async () => {
    await server.stop();
    await db.close();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
