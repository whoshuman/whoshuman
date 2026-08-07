import axios from "axios";

export const AUTH_UNAUTHORIZED_EVENT = "auth:unauthorized";

export const httpClient = axios.create({
  baseURL: (import.meta.env.VITE_API_URL as string) || "/api"
});

httpClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("authToken");
  if (token) {
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  config.headers["Accept-Language"] = localStorage.getItem("lang") || "es";
  return config;
});

httpClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
    }
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  }
);
