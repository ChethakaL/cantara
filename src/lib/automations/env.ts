import { getProjectEnv } from '@/lib/project-env'

/** True for 1/true/yes; empty uses defaultValue. */
export function envFlag(key: string, defaultValue: boolean) {
  const raw = (getProjectEnv(key) || '').trim().toLowerCase()
  if (!raw) return defaultValue
  return raw === '1' || raw === 'true' || raw === 'yes'
}

export function envOrNull(key: string) {
  const v = (getProjectEnv(key) || '').trim()
  return v || null
}
