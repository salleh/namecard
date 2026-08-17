// Shared "is this staff-fillable field usable?" guard. A field counts as
// blank if it is null/undefined or contains only whitespace, so accidental
// whitespace-only input doesn't produce an empty vCard property line.
//
// The predicate narrows the FALSE branch to `string` (the useful case: every
// caller treats a non-blank value as a usable string). Whitespace-only strings
// still return true; no caller relies on the true-branch type.
export function isBlank(value: string | null | undefined): value is null | undefined {
  return value === null || value === undefined || value.trim().length === 0;
}
