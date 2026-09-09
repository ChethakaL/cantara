/**
 * Dual-approval workflow for Agent Status.
 * Stored on ClientProfile.sectionSubmissions.agentApprovals[agentKey] (JSON — no migration).
 *
 * Flow:
 * 1. Agent runs → Assignee = In Review, Craig = Waiting
 * 2. Assignee approves → Craig = In Review
 * 3. Craig may attach a Google Doc + request changes → Assignee = In Review again
 * 4. Assignee re-approves → back to Craig
 * 5. Craig final-approves → status=approved (enables client release)
 */

export type AssigneeApprovalStatus = 'waiting' | 'in_review' | 'approved'
export type CraigApprovalStatus = 'waiting' | 'in_review' | 'changes_requested' | 'approved'

/** Only this admin may perform Craig Review column actions. */
export const CRAIG_REVIEWER_EMAIL = 'craig@cantarapet.com'

export const CRAIG_ONLY_ACTIONS = new Set([
  'craig_approve',
  'craig_request_changes',
  'save_feedback_doc',
  'revert_review',
])

export function isCraigReviewer(email: string | null | undefined): boolean {
  return (email ?? '').trim().toLowerCase() === CRAIG_REVIEWER_EMAIL
}

/**
 * Assignee Approval is only allowed for the advisor listed in Assigned To
 * (matched by name or email, case-insensitive).
 */
export function isAssignedReviewer(
  actorEmail: string | null | undefined,
  assignedTo: string | null | undefined,
  reviewers: Array<{ name: string; email: string }>,
): boolean {
  const assigned = (assignedTo ?? '').trim().toLowerCase()
  if (!assigned) return false
  const email = (actorEmail ?? '').trim().toLowerCase()
  if (!email) return false

  const actor = reviewers.find((r) => r.email.trim().toLowerCase() === email)
  if (!actor) {
    // Fallback: assignedTo might already be the actor's email
    return assigned === email
  }

  const actorName = actor.name.trim().toLowerCase()
  const actorEmailNorm = actor.email.trim().toLowerCase()
  return assigned === actorName || assigned === actorEmailNorm
}

export type AgentApprovalWorkflow = {
  assignedTo?: string | null
  /** Legacy single-step flag — kept as final Craig approval for release gates. */
  status?: 'approved' | 'in_review'
  approvedAt?: string
  assigneeStatus?: AssigneeApprovalStatus
  assigneeApprovedAt?: string | null
  craigStatus?: CraigApprovalStatus
  craigApprovedAt?: string | null
  changesRequestedAt?: string | null
  feedbackDocUrl?: string | null
}

export function normalizeFeedbackDocUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.toString()
  } catch {
    return null
  }
}

export function deriveApprovalWorkflow(
  entry: AgentApprovalWorkflow | null | undefined,
  hasRun: boolean,
): {
  assigneeStatus: AssigneeApprovalStatus
  craigStatus: CraigApprovalStatus
  feedbackDocUrl: string | null
  finalApproved: boolean
} {
  const feedbackDocUrl = normalizeFeedbackDocUrl(entry?.feedbackDocUrl)

  // Legacy: single "approved" means both sides done.
  if (entry?.status === 'approved' && !entry.assigneeStatus && !entry.craigStatus) {
    return {
      assigneeStatus: 'approved',
      craigStatus: 'approved',
      feedbackDocUrl,
      finalApproved: true,
    }
  }

  let assigneeStatus: AssigneeApprovalStatus =
    entry?.assigneeStatus === 'approved' || entry?.assigneeStatus === 'in_review' || entry?.assigneeStatus === 'waiting'
      ? entry.assigneeStatus
      : hasRun
        ? 'in_review'
        : 'waiting'

  let craigStatus: CraigApprovalStatus =
    entry?.craigStatus === 'approved' ||
    entry?.craigStatus === 'in_review' ||
    entry?.craigStatus === 'changes_requested' ||
    entry?.craigStatus === 'waiting'
      ? entry.craigStatus
      : 'waiting'

  // After a run with no workflow yet, assignee owns review.
  if (hasRun && !entry?.assigneeStatus && !entry?.craigStatus && entry?.status !== 'approved') {
    assigneeStatus = 'in_review'
    craigStatus = 'waiting'
  }

  // If Craig requested changes, assignee is back in review.
  if (craigStatus === 'changes_requested') {
    assigneeStatus = 'in_review'
  }

  // Craig cannot be in review until assignee approved (unless changes round already started).
  if (assigneeStatus === 'approved' && craigStatus === 'waiting') {
    craigStatus = 'in_review'
  }

  if (!hasRun) {
    assigneeStatus = 'waiting'
    if (craigStatus !== 'approved') craigStatus = 'waiting'
  }

  const finalApproved = craigStatus === 'approved'

  return { assigneeStatus, craigStatus, feedbackDocUrl, finalApproved }
}

export function applyAssigneeApprove(entry: AgentApprovalWorkflow): AgentApprovalWorkflow {
  return {
    ...entry,
    assigneeStatus: 'approved',
    assigneeApprovedAt: new Date().toISOString(),
    craigStatus: entry.craigStatus === 'approved' ? 'approved' : 'in_review',
    status: entry.craigStatus === 'approved' ? 'approved' : 'in_review',
  }
}

export function applyCraigRequestChanges(
  entry: AgentApprovalWorkflow,
  feedbackDocUrl?: string | null,
): AgentApprovalWorkflow {
  const next: AgentApprovalWorkflow = {
    ...entry,
    assigneeStatus: 'in_review',
    craigStatus: 'changes_requested',
    changesRequestedAt: new Date().toISOString(),
    status: 'in_review',
  }
  delete next.approvedAt
  delete next.craigApprovedAt
  if (typeof feedbackDocUrl !== 'undefined') {
    next.feedbackDocUrl = normalizeFeedbackDocUrl(feedbackDocUrl)
  }
  return next
}

export function applyCraigApprove(entry: AgentApprovalWorkflow, feedbackDocUrl?: string | null): AgentApprovalWorkflow {
  const next: AgentApprovalWorkflow = {
    ...entry,
    assigneeStatus: 'approved',
    craigStatus: 'approved',
    craigApprovedAt: new Date().toISOString(),
    status: 'approved',
    approvedAt: new Date().toISOString(),
  }
  if (typeof feedbackDocUrl !== 'undefined') {
    next.feedbackDocUrl = normalizeFeedbackDocUrl(feedbackDocUrl)
  }
  return next
}

export function applyRevertToReview(entry: AgentApprovalWorkflow): AgentApprovalWorkflow {
  const next: AgentApprovalWorkflow = {
    ...entry,
    assigneeStatus: 'in_review',
    craigStatus: 'waiting',
    status: 'in_review',
    assigneeApprovedAt: null,
    craigApprovedAt: null,
  }
  delete next.approvedAt
  return next
}
