/** Converts an entity's `null` fields (the API/Prisma convention for "not set") to `undefined` (what react-hook-form/zod expect for an optional field), for use as a form's defaultValues when editing an existing record. */
export function toFormDefaults<T extends object>(entity: T): { [K in keyof T]: Exclude<T[K], null> | undefined } {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(entity)) {
    result[key] = value === null ? undefined : value;
  }
  return result as { [K in keyof T]: Exclude<T[K], null> | undefined };
}
