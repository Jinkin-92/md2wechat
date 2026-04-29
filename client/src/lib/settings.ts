export const SETTINGS_KEY = "mdpublisher_settings";

export type AppSettings = {
  apiUrl: string;
  apiKey: string;
  model: string;
  platformName: string;
  originalChecked: boolean;
};

export const DEFAULT_SETTINGS: AppSettings = {
  apiUrl: "https://token-plan-cn.xiaomimimo.com/anthropic",
  apiKey: "",
  model: "mimo-v2.5",
  platformName: "",
  originalChecked: false
};

export function readAppSettings(): AppSettings {
  if (typeof window === "undefined") {
    return DEFAULT_SETTINGS;
  }

  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      return DEFAULT_SETTINGS;
    }

    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      apiUrl: parsed.apiUrl ?? DEFAULT_SETTINGS.apiUrl,
      apiKey: parsed.apiKey ?? DEFAULT_SETTINGS.apiKey,
      model: parsed.model ?? DEFAULT_SETTINGS.model,
      platformName: parsed.platformName ?? DEFAULT_SETTINGS.platformName,
      originalChecked: parsed.originalChecked ?? DEFAULT_SETTINGS.originalChecked
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function writeAppSettings(next: Partial<AppSettings>): AppSettings {
  const merged = {
    ...readAppSettings(),
    ...next
  };

  if (typeof window !== "undefined") {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
  }

  return merged;
}
