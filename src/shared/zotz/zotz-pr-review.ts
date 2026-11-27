/** The three verdicts of GitHub's review box. */
export const ZOTZ_PR_REVIEW_EVENTS = ['approve', 'request-changes', 'comment'] as const
export type ZotzPrReviewEvent = (typeof ZOTZ_PR_REVIEW_EVENTS)[number]

/** GitHub rejects "request changes" and "comment" without a body. */
export function zotzPrReviewNeedsBody(event: ZotzPrReviewEvent): boolean {
  return event !== 'approve'
}
