import { apiCall, setToken } from "./api.js";

export async function registerUser(user) {
  return apiCall("/auth/register", { method: "POST", body: user });
}

export async function loginUser(credentials) {
  const result = await apiCall("/auth/login", { method: "POST", body: credentials });
  if (result.data?.token) setToken(result.data.token);
  return result;
}

export function getCurrentUser() {
  return apiCall("/auth/me", { authenticated: true });
}

export function logout() {
  setToken(null);
}
