import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

// Fixed local container; this runner cannot target a hosted database.
const result = spawnSync('docker', [
  'exec', '-i', 'supabase_db_WinterArc2026', 'psql', '-U', 'postgres',
  '-d', 'postgres', '-v', 'ON_ERROR_STOP=1',
], { input: readFileSync(new URL('../supabase/tests/shared_challenges.sql', import.meta.url)), encoding: 'utf8' })
process.stdout.write(result.stdout ?? '')
process.stderr.write(result.stderr ?? '')
if (result.error) console.error(result.error.message)
process.exit(result.status ?? 1)
