/**
 * Shared fetch wrapper that always sends cookies (tenant_token / super_admin_token)
 * so the API can authenticate the request.
 */
export async function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  return fetch(url, { ...options, credentials: "include" });
}
