export type ApiError = Error & { status?: number };

export async function swrFetcher<T>(url: string): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    const fallbackMessage = `Request failed (${response.status})`;
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;

    const error = new Error(payload?.error ?? fallbackMessage) as ApiError;
    error.status = response.status;
    throw error;
  }

  return response.json() as Promise<T>;
}
