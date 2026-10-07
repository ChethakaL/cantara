import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildClientReleasedRoadmapMarkdown,
  isItemApprovedInMarkdown,
  normalizeTitleKey,
  toggleItemApprovalInMarkdown,
} from './roadmap-flag-items.ts'

const title = 'Owner & GM Dependency — No GM currently in place; execute on GM transition plan'

for (const rawTitle of [
  `**${title}** 🔴 RED`,
  `### **${title}** 🔴 RED`,
  `**Owner & GM Dependency** — No GM currently in place; execute on GM transition plan 🔴 RED`,
  `__${title}__ 🔴 RED`,
]) {
  test(`approves rendered title matching ${rawTitle}`, () => {
    const original = `## Red Flag Action Items\n\n${rawTitle}\n- **What**: Appoint the GM.\n\n## Yellow Flag Action Items\n\n**Insurance** 🟡 YELLOW\n- **What**: Renew coverage.`
    const key = normalizeTitleKey(title)
    assert.equal(normalizeTitleKey(rawTitle), key)
    const approved = toggleItemApprovalInMarkdown(original, key)
    assert.ok(approved.includes(`${rawTitle} <!-- portal: approved -->`))
    assert.equal(isItemApprovedInMarkdown(approved), true)
    const released = buildClientReleasedRoadmapMarkdown(approved, [])
    assert.ok(released.includes(title.split(' — ')[1]))
    assert.ok(released.includes('Appoint the GM.'))
    assert.ok(!released.includes('Renew coverage.'))
    assert.ok(!released.includes('portal:'))
    const excluded = toggleItemApprovalInMarkdown(approved, key)
    assert.ok(excluded.includes(`${rawTitle} <!-- portal: excluded -->`))
    assert.equal(isItemApprovedInMarkdown(excluded), false)
  })
}

test('successive approvals retain previously approved items and ignore detail lines', () => {
  const original = `## Red Flag Action Items\n\n**GM** 🔴 RED\n- **What**: Resolve RED staffing risk.\n\n## Yellow Flag Action Items\n\n**Insurance** 🟡 YELLOW\n- **What**: Renew coverage.`
  const first = toggleItemApprovalInMarkdown(original, normalizeTitleKey('GM'))
  const second = toggleItemApprovalInMarkdown(first, normalizeTitleKey('Insurance'))
  assert.equal((second.match(/portal: approved/g) ?? []).length, 2)
  const released = buildClientReleasedRoadmapMarkdown(second, [])
  assert.ok(released.includes('Resolve RED staffing risk.'))
  assert.ok(released.includes('Renew coverage.'))
  assert.equal(toggleItemApprovalInMarkdown(second, 'missing'), second)
})
