export function createSubmissionFlight() {
  let activeSubmission: number | null = null;
  let statusLookup = false;
  let sequence = 0;
  return {
    beginSubmission(): number | null {
      if (activeSubmission !== null || statusLookup) return null;
      activeSubmission = ++sequence;
      return activeSubmission;
    },
    isCurrentSubmission(token: number): boolean { return activeSubmission === token; },
    endSubmission(token: number): boolean {
      if (activeSubmission !== token) return false;
      activeSubmission = null;
      return true;
    },
    beginStatusLookup(): boolean {
      if (activeSubmission !== null || statusLookup) return false;
      statusLookup = true;
      return true;
    },
    endStatusLookup(): void { statusLookup = false; },
    hasActivity(): boolean { return activeSubmission !== null || statusLookup; },
  };
}
