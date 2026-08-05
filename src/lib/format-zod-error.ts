import type { z } from "zod";

/**
 * Formats a Zod validation error into a structured object with
 * field paths and human-readable messages.
 */
export function formatZodError(error: z.ZodError): {
  fields: Array<{ path: string; message: string }>;
} {
  return {
    fields: error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  };
}
