import fs from 'node:fs'
import path from 'node:path'
import { parse } from 'dotenv'

let cachedProjectEnv: Record<string, string> | null = null

function loadProjectEnv() {
  if (cachedProjectEnv) return cachedProjectEnv

  const envPath = path.join(process.cwd(), '.env')

  try {
    const raw = fs.readFileSync(envPath, 'utf8')
    cachedProjectEnv = parse(raw)
  } catch {
    cachedProjectEnv = {}
  }

  return cachedProjectEnv
}

export function getProjectEnv(key: string) {
  return loadProjectEnv()[key]
}
