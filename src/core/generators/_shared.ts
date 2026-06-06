export function sanitiseForComment(input: string): string {
  return input.replace(/[\r\n\t]+/g, " ");
}

export function pascalCase(input: string, fallback = "Unnamed"): string {
  const parts = input
    .replace(/[-_]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(part => part.length > 0);
  if (parts.length === 0) {
    return fallback;
  }
  const candidate = parts.map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join("");
  return /^[A-Za-z_]/.test(candidate) ? candidate : `S${candidate}`;
}
