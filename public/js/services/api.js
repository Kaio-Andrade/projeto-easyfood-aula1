const tokenKey = "easyfood.jwt";

export function getToken() {
  return sessionStorage.getItem(tokenKey);
}

export function setToken(token) {
  if (token) sessionStorage.setItem(tokenKey, token);
  else sessionStorage.removeItem(tokenKey);
}

export async function apiCall(endpoint, { method = "GET", body, authenticated = false } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (authenticated && getToken()) headers.Authorization = `Bearer ${getToken()}`;

  const response = await fetch(endpoint, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  return { status: response.status, data };
}
