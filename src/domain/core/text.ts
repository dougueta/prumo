/** Normalizações de texto do modelo core (R-06, R-11). Fonte única — o banco não normaliza. */

const stripMarks = (value: string) => value.normalize("NFKD").replace(/\p{M}/gu, "");

/** Descrição para identidade: NFKD, sem diacríticos, maiúsculas, espaços colapsados, trim. */
export function normalizeDescription(value: string): string {
  return stripMarks(value).toUpperCase().replace(/\s+/g, " ").trim();
}

/** Chave de nome de categoria/instituição: sem acento, minúsculas, trim (≈ core_name_key). */
export function nameKey(value: string): string {
  return stripMarks(value).toLowerCase().trim();
}
