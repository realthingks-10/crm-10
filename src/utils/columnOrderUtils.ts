export function moveFieldToEnd<T extends { field: string }>(
  columns: T[],
  fieldName: string,
): T[] {
  const idx = columns.findIndex((c) => c.field === fieldName);
  if (idx === -1) return columns;
  const col = columns[idx];
  return [...columns.slice(0, idx), ...columns.slice(idx + 1), col];
}
