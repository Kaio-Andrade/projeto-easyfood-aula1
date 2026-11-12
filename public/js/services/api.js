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
  const multipart = body instanceof FormData;
  if (body !== undefined && !multipart) headers["Content-Type"] = "application/json";
  if (authenticated && getToken()) headers.Authorization = `Bearer ${getToken()}`;

  const response = await fetch(endpoint, {
    method,
    headers,
    body: body === undefined ? undefined : multipart ? body : JSON.stringify(body)
  });
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  const sessionExpired = authenticated && response.status === 401;
  if (sessionExpired) {
    setToken(null);
    window.dispatchEvent(new Event("easyfood:session-expired"));
  }
  return { status: response.status, data, sessionExpired };
}

export function uploadImage(endpoint, file) {
  const body = new FormData();
  body.append("image", file);
  return apiCall(endpoint, { method: "POST", body, authenticated: true });
}
