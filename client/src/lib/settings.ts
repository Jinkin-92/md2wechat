export const SETTINGS_KEY = "mdpublisher_settings";

export type AppSettings = {
  textApiUrl: string;
  textApiKey: string;
  textModel: string;
  imageApiUrl: string;
  imageApiKey: string;
  imageModel: string;
  platformName: string;
  originalChecked: boolean;
};

export const DEFAULT_SETTINGS: AppSettings = {
  textApiUrl: "https://api.minimaxi.com/anthropic",
  textApiKey: "",
  textModel: "MiniMax-M2.7",
  imageApiUrl: "https://api.minimaxi.com",
  imageApiKey: "",
  imageModel: "image-01",
  platformName: "",
  originalChecked: false
};

function migrateLegacySettings(parsed: Record<string, unknown>): Partial<AppSettings> {
  const migrated: Partial<AppSettings> = {};

  // Legacy fields (pre-v0.2) were apiUrl / apiKey / model — treat as text AI config
  if (typeof parsed.apiUrl === "string" && parsed.apiUrl && !parsed.textApiUrl) {
    migrated.textApiUrl = parsed.apiUrl;
  }
  if (typeof parsed.apiKey === "string" && parsed.apiKey && !parsed.textApiKey) {
    migrated.textApiKey = parsed.apiKey;
  }
  if (typeof parsed.model === "string" && parsed.model && !parsed.textModel) {
    migrated.textModel = parsed.model;
  }

  return migrated;
}

export function readAppSettings(): AppSettings {
  if (typeof window === "undefined") {
    return DEFAULT_SETTINGS;
  }

  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      return DEFAULT_SETTINGS;
    }

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const legacy = migrateLegacySettings(parsed);

    return {
      textApiUrl: (parsed.textApiUrl as string) ?? legacy.textApiUrl ?? DEFAULT_SETTINGS.textApiUrl,
      textApiKey: (parsed.textApiKey as string) ?? legacy.textApiKey ?? DEFAULT_SETTINGS.textApiKey,
      textModel: (parsed.textModel as string) ?? legacy.textModel ?? DEFAULT_SETTINGS.textModel,
      imageApiUrl: (parsed.imageApiUrl as string) ?? DEFAULT_SETTINGS.imageApiUrl,
      imageApiKey: (parsed.imageApiKey as string) ?? DEFAULT_SETTINGS.imageApiKey,
      imageModel: (parsed.imageModel as string) ?? DEFAULT_SETTINGS.imageModel,
      platformName: (parsed.platformName as string) ?? DEFAULT_SETTINGS.platformName,
      originalChecked: (parsed.originalChecked as boolean) ?? DEFAULT_SETTINGS.originalChecked
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
