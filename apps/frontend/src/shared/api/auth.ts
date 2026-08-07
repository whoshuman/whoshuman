import type { AuthRefreshResponse, AuthSessionResponse } from "@whoshuman/shared-types";
import { httpClient } from "./httpClient";

export async function login(email: string, password: string): Promise<AuthSessionResponse> {
  const { data } = await httpClient.post<AuthSessionResponse>("/auth/login", { email, password });
  return data;
}

export async function register(
  email: string,
  username: string,
  password: string,
  language: string
): Promise<AuthSessionResponse> {
  const { data } = await httpClient.post<AuthSessionResponse>("/auth/register", {
    email,
    username,
    password,
    language
  });
  return data;
}

export async function completeOAuth(
  ticket: string,
  username: string | undefined,
  language: string
): Promise<AuthSessionResponse> {
  const { data } = await httpClient.post<AuthSessionResponse>("/auth/oauth/complete", {
    ticket,
    username,
    language
  });
  return data;
}

export async function refresh(refreshToken: string): Promise<AuthRefreshResponse> {
  const { data } = await httpClient.post<AuthRefreshResponse>("/auth/refresh", { refreshToken });
  return data;
}

export async function logout(refreshToken: string): Promise<void> {
  await httpClient.post("/auth/logout", { refreshToken });
}
