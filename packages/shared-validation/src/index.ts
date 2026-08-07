export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 24;

export const AVATAR_MAX_LENGTH = 80_000;
export const AVATAR_PATTERN =
  /^(?:https:\/\/[^\s]{1,2048}|data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2})$/;

export const SUPPORTED_LANGUAGES = ["es", "en", "fr"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: SupportedLanguage = "en";
