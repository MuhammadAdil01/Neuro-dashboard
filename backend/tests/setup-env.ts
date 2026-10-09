// Tests run against TEST_DATABASE_URL when set, otherwise the DATABASE_URL in .env.
// Start a disposable local database with `npm run test:db` and run `npm run db:migrate` + `npm run db:seed` first.
import 'dotenv/config';

process.env.NODE_ENV = 'test';
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.JWT_SECRET ??= 'test-secret-that-is-long-enough-for-validation-1234';
