import axios from "axios";

export const httpClient = axios.create({
  baseURL: (import.meta.env.VITE_API_URL as string) || "http://localhost:3000/api"
});

httpClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("authToken");
  if (token) {
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

httpClient.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error instanceof Error ? error : new Error(String(error)))
);
