// Opt-in only: absence is the existing payment path, never an inferred statement.
export function parsePostServiceConfirmation(form: FormData): boolean | null {
  const values = form.getAll("postServiceConfirmed");
  if (values.length === 0) return false;
  return values.length === 1 && values[0] === "confirmed" ? true : null;
}
