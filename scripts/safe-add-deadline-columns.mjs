/**
 * Applies only additive deadline columns. Safe to run multiple times.
 * Does NOT use prisma db push or --accept-data-loss.
 */
import pg from 'pg'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  try {
    const env = readFileSync(resolve(root, '.env'), 'utf8')
    const match = env.match(/^DATABASE_URL=(.+)$/m)
    if (match) return match[1].trim().replace(/^["']|["']$/g, '')
  } catch {
    // ignore
  }
  throw new Error('DATABASE_URL not set. Export it or add it to .env')
}

const sql = `
ALTER TABLE "ClientDocumentStatus" ADD COLUMN IF NOT EXISTS "targetDeadline" TIMESTAMP(3);
ALTER TABLE "ClientProfile" ADD COLUMN IF NOT EXISTS "sectionDeadlines" JSONB;
`

const databaseUrl = loadDatabaseUrl()
const client = new pg.Client({ connectionString: databaseUrl })

try {
  await client.connect()
  await client.query(sql)
  console.log('OK: deadline columns are present (or were already added).')
} finally {
  await client.end()
}
