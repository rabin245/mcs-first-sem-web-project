interface ApiErrorShape {
  response?: { data?: { error?: string } };
  message?: string;
}

export function errorMessage(
  error: unknown,
  fallback = "Something went wrong",
): string {
  const e = error as ApiErrorShape;
  return e.response?.data?.error || e.message || fallback;
}
