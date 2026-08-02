import { Response } from "express";
import { ZodSchema } from "zod";

export function validate<T>(
  schema: ZodSchema<T>,
  data: unknown,
  res: Response,
): T | null {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.errors.map((e) => ({
      field: e.path.join("."),
      message: e.message,
    }));
    res.status(400).json({ error: "Validation failed", errors });
    return null;
  }
  return result.data;
}
