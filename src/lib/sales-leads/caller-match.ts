export type MatchableCaller = {
  id: string
  name: string
  email: string
}

/** Monday People columns can list several names, comma-separated. Use the first. */
export function firstMondayPersonName(text: string) {
  return text.split(',')[0].replace(/\s+/g, ' ').trim()
}

function scoreCallerNameMatch(mondayLabel: string, caller: MatchableCaller) {
  const label = mondayLabel.toLowerCase()
  const name = caller.name.replace(/\s+/g, ' ').trim().toLowerCase()
  const emailLocal = caller.email.split('@')[0].toLowerCase().replace(/[._]+/g, ' ').trim()
  const labelTokens = label.split(' ').filter(Boolean)
  const nameTokens = name.split(' ').filter(Boolean)

  if (!label || !name) return 0
  if (name === label) return 100
  if (emailLocal === label) return 90
  if (label.startsWith(`${name} `)) return 80
  if (
    nameTokens.length >= 2
    && labelTokens[0] === nameTokens[0]
    && labelTokens.includes(nameTokens[nameTokens.length - 1])
  ) {
    return 75
  }
  if (nameTokens.length === 1 && nameTokens[0].length >= 3 && labelTokens[0] === nameTokens[0]) {
    return 70
  }
  if (labelTokens[0] && labelTokens[0].length >= 3 && emailLocal.split(' ')[0] === labelTokens[0]) {
    return 50
  }
  return 0
}

export function matchMondayPersonName(mondayText: string, callers: MatchableCaller[]) {
  const label = firstMondayPersonName(mondayText)
  if (!label) return null

  const ranked = callers
    .map(caller => ({ caller, score: scoreCallerNameMatch(label, caller) }))
    .filter(row => row.score > 0)
    .sort((a, b) => b.score - a.score || b.caller.name.length - a.caller.name.length)

  if (!ranked.length) return null
  if (ranked.length === 1 || ranked[0].score > ranked[1].score) return ranked[0].caller
  return null
}
