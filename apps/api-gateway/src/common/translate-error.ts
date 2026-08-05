import { I18nContext } from "nestjs-i18n";

export function translateError(key: string): string {
  const i18n = I18nContext.current();
  if (!i18n) return key;
  return i18n.t(`errors.${key}`, { defaultValue: key });
}
