/**
 * Parameter object for classifying and handling a failed test-and-set call
 * (keeps `NumeratorService.handleTestAndSetFailure` within the 2-params rule).
 */
export interface CasFailureContext {
  error: unknown;
  attempt: number;
  maxRetries: number;
  currentNumerator: number;
  candidate: number;
}
