/**
 * Parameter object for classifying and handling a failed test-and-set call
 * (TODO-04 §1.3–§1.4; global plan G5/G8 conflict path). Keeps
 * `NumeratorService.handleTestAndSetFailure` within the 2-params rule.
 */
export interface CasFailureContext {
  error: unknown;
  attempt: number;
  maxRetries: number;
  currentNumerator: number;
  candidate: number;
}
