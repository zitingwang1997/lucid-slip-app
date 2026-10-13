const POEM_CLAUSE_PATTERN = /[^，,。.!！？?；;\n]+[，,。.!！？?；;]?/g;
const POEM_END_PATTERN = /[，,。.!！？?；;]$/;

function normalizePoemColumn(text: string) {
  if (!text) return "";
  return POEM_END_PATTERN.test(text) ? text : `${text}。`;
}

export function getPoemColumns(poem: string | null | undefined) {
  const clauses =
    (poem ?? "")
      .match(POEM_CLAUSE_PATTERN)
      ?.map((clause) => clause.trim())
      .filter(Boolean) ?? [];

  const midpoint = Math.ceil(clauses.length / 2);

  return {
    rightColumn: normalizePoemColumn(clauses.slice(0, midpoint).join("")),
    leftColumn: normalizePoemColumn(clauses.slice(midpoint).join("")),
  };
}
