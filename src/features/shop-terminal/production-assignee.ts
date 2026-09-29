/** Missing draft choices inherit the location default; explicit choices fail closed. */
export function resolveProductionAssignee(
  assignments: ReadonlyArray<{ id: string }>,
  configuredDefault: string | null,
  explicitChoice?: string,
): string {
  const candidate = explicitChoice === undefined ? configuredDefault : explicitChoice;
  return candidate && assignments.some((assignment) => assignment.id === candidate) ? candidate : "";
}
