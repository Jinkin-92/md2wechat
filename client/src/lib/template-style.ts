export type TemplateCardStyle = {
  bg: string;
  text: string;
  accent: string;
  fontFamily: string;
  chip: string;
  surface?: string;
};

export const TEMPLATE_CARD_STYLES: Record<string, TemplateCardStyle> = {
  claude: {
    bg: "linear-gradient(135deg, #f3e7da 0%, #fbf6ef 100%)",
    text: "#3f342e",
    accent: "#c96442",
    fontFamily: "Georgia, serif",
    chip: "Warm Editorial",
    surface: "#faf9f5"
  },
  cohere: {
    bg: "linear-gradient(135deg, #eef4ff 0%, #fafcff 100%)",
    text: "#111827",
    accent: "#1863dc",
    fontFamily: "'Segoe UI', sans-serif",
    chip: "Data Dashboard",
    surface: "#fafafa"
  },
  elevenlabs: {
    bg: "linear-gradient(135deg, #f8f8f8 0%, #ffffff 100%)",
    text: "#18181b",
    accent: "#111111",
    fontFamily: "'Trebuchet MS', sans-serif",
    chip: "Cinematic Voice",
    surface: "#ffffff"
  },
  minimax: {
    bg: "linear-gradient(135deg, #eef4ff 0%, #ffffff 100%)",
    text: "#0f172a",
    accent: "#1456f0",
    fontFamily: "'Segoe UI', sans-serif",
    chip: "Bold Product",
    surface: "#ffffff"
  },
  "mistral-ai": {
    bg: "linear-gradient(135deg, #ffeab1 0%, #fff5d9 100%)",
    text: "#281b0d",
    accent: "#fa520f",
    fontFamily: "Arial, sans-serif",
    chip: "Sharp Contrast",
    surface: "#fff0c2"
  },
  ollama: {
    bg: "linear-gradient(135deg, #f0ebff 0%, #faf8ff 100%)",
    text: "#2e2941",
    accent: "#7c6af7",
    fontFamily: "'Noto Sans SC', sans-serif",
    chip: "Local Terminal",
    surface: "#ffffff"
  },
  replicate: {
    bg: "linear-gradient(135deg, #ffe0e4 0%, #fff3f4 100%)",
    text: "#57181d",
    accent: "#e53e3e",
    fontFamily: "'ZCOOL XiaoWei', serif",
    chip: "Creator Lab",
    surface: "#fff4f6"
  },
  "together-ai": {
    bg: "linear-gradient(135deg, #edf9ff 0%, #ffffff 100%)",
    text: "#16324f",
    accent: "#0ea5e9",
    fontFamily: "'Ma Shan Zheng', cursive",
    chip: "Blueprint",
    surface: "#ffffff"
  },
  spotify: {
    bg: "linear-gradient(135deg, #121212 0%, #1f1f1f 100%)",
    text: "#ffffff",
    accent: "#1ed760",
    fontFamily: "'Inter', sans-serif",
    chip: "Music Streaming",
    surface: "#181818"
  },
  ferrari: {
    bg: "linear-gradient(135deg, #181818 0%, #303030 100%)",
    text: "#ffffff",
    accent: "#da291c",
    fontFamily: "'Inter', sans-serif",
    chip: "Luxury Automotive",
    surface: "#181818"
  },
  playstation: {
    bg: "linear-gradient(135deg, #000000 0%, #181818 100%)",
    text: "#000000",
    accent: "#0070d1",
    fontFamily: "'Inter', sans-serif",
    chip: "Gaming Console",
    surface: "#ffffff"
  },
  nike: {
    bg: "linear-gradient(135deg, #ffffff 0%, #f5f5f5 100%)",
    text: "#111111",
    accent: "#111111",
    fontFamily: "'Inter', sans-serif",
    chip: "Athletic Retail",
    surface: "#ffffff"
  }
};

export function getTemplateCardStyle(templateId: string): TemplateCardStyle {
  return (
    TEMPLATE_CARD_STYLES[templateId] ?? {
      bg: "linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)",
      text: "#111827",
      accent: "#2563eb",
      fontFamily: "inherit",
      chip: "Template",
      surface: "#ffffff"
    }
  );
}
