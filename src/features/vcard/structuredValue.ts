// Joins semicolon-separated structured-value components (e.g. `ORG`),
// dropping only *trailing* empty components. Interior empty components are
// preserved because their position is meaningful (e.g. `a;;c`).
export function joinTrimTrailingEmpty(components: readonly string[]): string {
  const lastNonEmptyIndex = components.reduce(
    (lastIndex, component, index) => (component === "" ? lastIndex : index),
    -1,
  );
  if (lastNonEmptyIndex === -1) {
    return "";
  }
  return components.slice(0, lastNonEmptyIndex + 1).join(";");
}
