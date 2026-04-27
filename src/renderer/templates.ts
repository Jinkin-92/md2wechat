export type TemplateDefinition = {
  id: string;
  name: string;
  description: string;
  tokens: {
    pageBackground: string;
    cardBackground: string;
    textColor: string;
    headingColor: string;
    accentColor: string;
    borderColor: string;
    quoteBackground: string;
    codeBackground: string;
    mutedColor: string;
    fontSize: string;
    lineHeight: string;
    h1Size: string;
    h2Size: string;
    h3Size: string;
    fontFamily: string;
    fontFamilyMono: string;
    h1FontFamily: string;
    h2FontFamily: string;
    h3FontFamily: string;
    blockquoteStyle: "left-border" | "background" | "italic" | "double-border" | "none";
    blockquoteTextColor: string;
    hrStyle: "line" | "dashed" | "double" | "ornament" | "gradient" | "space";
    cardRadius: string;
    cardShadow: string;
    codeTextColor: string;
    codeBorderRadius: string;
    listStyle: "disc" | "circle" | "square" | "none";
    paragraphMargin: string;
    sectionMargin: string;
    h1MarginBottom: string;
    h2MarginTop: string;
    h2MarginBottom: string;
    h3MarginTop: string;
    h3MarginBottom: string;
  };
};

const templates: TemplateDefinition[] = [
  {
    id: "claude",
    name: "Claude",
    description: "Anthropic's AI assistant. Warm terracotta accent, clean editorial layout.",
    tokens: {
      pageBackground: "#f5f4ed",
      cardBackground: "#faf9f5",
      textColor: "#4d4c48",
      headingColor: "#141413",
      accentColor: "#c96442",
      borderColor: "#e8e6dc",
      quoteBackground: "#f0eee6",
      codeBackground: "#f5f4ed",
      mutedColor: "#87867f",
      fontSize: "15px",
      lineHeight: "1.7",
      h1Size: "30px",
      h2Size: "22px",
      h3Size: "18px",
      fontFamily: "Georgia, 'Times New Roman', serif",
      fontFamilyMono: "'SF Mono', Consolas, monospace",
      h1FontFamily: "Georgia, 'Times New Roman', serif",
      h2FontFamily: "Georgia, 'Times New Roman', serif",
      h3FontFamily: "Georgia, 'Times New Roman', serif",
      blockquoteStyle: "left-border",
      blockquoteTextColor: "#4d4c48",
      hrStyle: "line",
      cardRadius: "20px",
      cardShadow: "0 8px 32px rgba(20,20,19,0.08)",
      codeTextColor: "#4d4c48",
      codeBorderRadius: "8px",
      listStyle: "disc",
      paragraphMargin: "0 0 16px",
      sectionMargin: "32px 0",
      h1MarginBottom: "20px",
      h2MarginTop: "32px",
      h2MarginBottom: "16px",
      h3MarginTop: "24px",
      h3MarginBottom: "12px"
    }
  },
  {
    id: "cohere",
    name: "Cohere",
    description: "Enterprise AI platform. Vibrant gradients, data-rich dashboard aesthetic.",
    tokens: {
      pageBackground: "#ffffff",
      cardBackground: "#fafafa",
      textColor: "#212121",
      headingColor: "#000000",
      accentColor: "#1863dc",
      borderColor: "#e5e7eb",
      quoteBackground: "#f0f4ff",
      codeBackground: "#17171c",
      mutedColor: "#93939f",
      fontSize: "15px",
      lineHeight: "1.65",
      h1Size: "42px",
      h2Size: "28px",
      h3Size: "20px",
      fontFamily: "'Unica77', system-ui, sans-serif",
      fontFamilyMono: "'SF Mono', Consolas, monospace",
      h1FontFamily: "'Unica77', system-ui, sans-serif",
      h2FontFamily: "'Unica77', system-ui, sans-serif",
      h3FontFamily: "'Unica77', system-ui, sans-serif",
      blockquoteStyle: "background",
      blockquoteTextColor: "#212121",
      hrStyle: "gradient",
      cardRadius: "22px",
      cardShadow: "0 4px 24px rgba(24,99,220,0.1)",
      codeTextColor: "#ffffff",
      codeBorderRadius: "12px",
      listStyle: "circle",
      paragraphMargin: "0 0 14px",
      sectionMargin: "28px 0",
      h1MarginBottom: "24px",
      h2MarginTop: "28px",
      h2MarginBottom: "14px",
      h3MarginTop: "20px",
      h3MarginBottom: "10px"
    }
  },
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    description: "AI voice platform. Dark cinematic UI, audio-waveform aesthetics.",
    tokens: {
      pageBackground: "#ffffff",
      cardBackground: "#ffffff",
      textColor: "#292524",
      headingColor: "#000000",
      accentColor: "#000000",
      borderColor: "#e5e5e5",
      quoteBackground: "#f5f5f5",
      codeBackground: "#292524",
      mutedColor: "#777169",
      fontSize: "16px",
      lineHeight: "1.6",
      h1Size: "34px",
      h2Size: "26px",
      h3Size: "20px",
      fontFamily: "Inter, system-ui, sans-serif",
      fontFamilyMono: "'Geist Mono', 'SF Mono', monospace",
      h1FontFamily: "'Waldenburg', Inter, sans-serif",
      h2FontFamily: "'Waldenburg', Inter, sans-serif",
      h3FontFamily: "'Waldenburg', Inter, sans-serif",
      blockquoteStyle: "italic",
      blockquoteTextColor: "#292524",
      hrStyle: "space",
      cardRadius: "12px",
      cardShadow: "0 2px 12px rgba(0,0,0,0.04)",
      codeTextColor: "#ffffff",
      codeBorderRadius: "4px",
      listStyle: "square",
      paragraphMargin: "0 0 18px",
      sectionMargin: "36px 0",
      h1MarginBottom: "18px",
      h2MarginTop: "36px",
      h2MarginBottom: "18px",
      h3MarginTop: "28px",
      h3MarginBottom: "14px"
    }
  },
  {
    id: "minimax",
    name: "MiniMax",
    description: "AI model provider. Bold dark interface with neon accents.",
    tokens: {
      pageBackground: "#ffffff",
      cardBackground: "#ffffff",
      textColor: "#222222",
      headingColor: "#18181b",
      accentColor: "#1456f0",
      borderColor: "#e5e7eb",
      quoteBackground: "#bfdbfe",
      codeBackground: "#f0f0f0",
      mutedColor: "#8e8e93",
      fontSize: "15px",
      lineHeight: "1.7",
      h1Size: "36px",
      h2Size: "24px",
      h3Size: "18px",
      fontFamily: "'DM Sans', system-ui, sans-serif",
      fontFamilyMono: "'SF Mono', Consolas, monospace",
      h1FontFamily: "'Outfit', 'DM Sans', sans-serif",
      h2FontFamily: "'Outfit', 'DM Sans', sans-serif",
      h3FontFamily: "'Poppins', 'DM Sans', sans-serif",
      blockquoteStyle: "left-border",
      blockquoteTextColor: "#222222",
      hrStyle: "dashed",
      cardRadius: "20px",
      cardShadow: "0 8px 32px rgba(20,86,240,0.12)",
      codeTextColor: "#18181b",
      codeBorderRadius: "8px",
      listStyle: "disc",
      paragraphMargin: "0 0 14px",
      sectionMargin: "28px 0",
      h1MarginBottom: "20px",
      h2MarginTop: "28px",
      h2MarginBottom: "14px",
      h3MarginTop: "22px",
      h3MarginBottom: "10px"
    }
  },
  {
    id: "mistral-ai",
    name: "Mistral AI",
    description: "Open-weight LLM provider. French-engineered minimalism, purple-toned.",
    tokens: {
      pageBackground: "#fffaeb",
      cardBackground: "#fff0c2",
      textColor: "#1f1f1f",
      headingColor: "#1f1f1f",
      accentColor: "#fa520f",
      borderColor: "#ffe295",
      quoteBackground: "#ffd06a",
      codeBackground: "#1f1f1f",
      mutedColor: "#666666",
      fontSize: "16px",
      lineHeight: "1.6",
      h1Size: "46px",
      h2Size: "30px",
      h3Size: "22px",
      fontFamily: "Arial, Helvetica, sans-serif",
      fontFamilyMono: "'SF Mono', Consolas, monospace",
      h1FontFamily: "Arial, Helvetica, sans-serif",
      h2FontFamily: "Arial, Helvetica, sans-serif",
      h3FontFamily: "Arial, Helvetica, sans-serif",
      blockquoteStyle: "double-border",
      blockquoteTextColor: "#1f1f1f",
      hrStyle: "ornament",
      cardRadius: "0px",
      cardShadow: "0 8px 24px rgba(250,82,15,0.15)",
      codeTextColor: "#ffffff",
      codeBorderRadius: "0px",
      listStyle: "circle",
      paragraphMargin: "0 0 16px",
      sectionMargin: "32px 0",
      h1MarginBottom: "24px",
      h2MarginTop: "32px",
      h2MarginBottom: "16px",
      h3MarginTop: "24px",
      h3MarginBottom: "12px"
    }
  },
  {
    id: "ollama",
    name: "Ollama",
    description: "Run LLMs locally. Terminal-first, monochrome simplicity.",
    tokens: {
      pageBackground: "#f7f6f3",
      cardBackground: "#f7f4ff",
      textColor: "#2e2941",
      headingColor: "#1e1630",
      accentColor: "#7c6af7",
      borderColor: "#e8e6e0",
      quoteBackground: "#f0eff7",
      codeBackground: "#2d2d2d",
      mutedColor: "#8a8680",
      fontSize: "15px",
      lineHeight: "1.75",
      h1Size: "32px",
      h2Size: "24px",
      h3Size: "19px",
      fontFamily: "'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif",
      fontFamilyMono: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
      h1FontFamily: "'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif",
      h2FontFamily: "'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif",
      h3FontFamily: "'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif",
      blockquoteStyle: "left-border",
      blockquoteTextColor: "#363532",
      hrStyle: "dashed",
      cardRadius: "6px",
      cardShadow: "0 1px 3px rgba(0,0,0,0.06)",
      codeTextColor: "#e8e6e0",
      codeBorderRadius: "6px",
      listStyle: "square",
      paragraphMargin: "0 0 12px",
      sectionMargin: "24px 0",
      h1MarginBottom: "16px",
      h2MarginTop: "24px",
      h2MarginBottom: "12px",
      h3MarginTop: "20px",
      h3MarginBottom: "10px"
    }
  },
  {
    id: "opencode-ai",
    name: "OpenCode AI",
    description: "AI coding platform. Developer-centric dark theme.",
    tokens: {
      pageBackground: "#1a1b1e",
      cardBackground: "#25262b",
      textColor: "#e6edf3",
      headingColor: "#ffffff",
      accentColor: "#58a6ff",
      borderColor: "#303030",
      quoteBackground: "#0b1220",
      codeBackground: "#0d1117",
      mutedColor: "#c9d1d9",
      fontSize: "14px",
      lineHeight: "1.7",
      h1Size: "34px",
      h2Size: "22px",
      h3Size: "17px",
      fontFamily: "'Source Han Sans SC', 'Noto Sans SC', 'PingFang SC', sans-serif",
      fontFamilyMono: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
      h1FontFamily: "'Source Han Sans SC', 'Noto Sans SC', 'PingFang SC', sans-serif",
      h2FontFamily: "'Source Han Sans SC', 'Noto Sans SC', 'PingFang SC', sans-serif",
      h3FontFamily: "'Source Han Sans SC', 'Noto Sans SC', 'PingFang SC', sans-serif",
      blockquoteStyle: "left-border",
      blockquoteTextColor: "#f0f6fc",
      hrStyle: "dashed",
      cardRadius: "12px",
      cardShadow: "0 4px 16px rgba(0,0,0,0.3)",
      codeTextColor: "#e6edf3",
      codeBorderRadius: "8px",
      listStyle: "circle",
      paragraphMargin: "0 0 14px",
      sectionMargin: "28px 0",
      h1MarginBottom: "20px",
      h2MarginTop: "28px",
      h2MarginBottom: "14px",
      h3MarginTop: "22px",
      h3MarginBottom: "10px"
    }
  },
  {
    id: "replicate",
    name: "Replicate",
    description: "Run ML models via API. Clean white canvas, code-forward.",
    tokens: {
      pageBackground: "#fff5f7",
      cardBackground: "#fff1f4",
      textColor: "#3f0714",
      headingColor: "#2f0d17",
      accentColor: "#e53e3e",
      borderColor: "#fecdd3",
      quoteBackground: "#4a0715",
      codeBackground: "#1a202c",
      mutedColor: "#7a1f35",
      fontSize: "15px",
      lineHeight: "1.7",
      h1Size: "38px",
      h2Size: "26px",
      h3Size: "20px",
      fontFamily: "'ZCOOL XiaoWei', 'Noto Serif SC', 'Source Han Serif SC', serif",
      fontFamilyMono: "'JetBrains Mono', 'Fira Code', monospace",
      h1FontFamily: "'ZCOOL XiaoWei', 'Noto Serif SC', 'Source Han Serif SC', serif",
      h2FontFamily: "'ZCOOL XiaoWei', 'Noto Serif SC', 'Source Han Serif SC', serif",
      h3FontFamily: "'ZCOOL XiaoWei', 'Noto Serif SC', 'Source Han Serif SC', serif",
      blockquoteStyle: "left-border",
      blockquoteTextColor: "#e2e8f0",
      hrStyle: "double",
      cardRadius: "24px",
      cardShadow: "0 12px 32px rgba(229,62,62,0.12)",
      codeTextColor: "#e2e8f0",
      codeBorderRadius: "12px",
      listStyle: "disc",
      paragraphMargin: "0 0 14px",
      sectionMargin: "28px 0",
      h1MarginBottom: "22px",
      h2MarginTop: "28px",
      h2MarginBottom: "14px",
      h3MarginTop: "22px",
      h3MarginBottom: "10px"
    }
  },
  {
    id: "runwayml",
    name: "RunwayML",
    description: "AI video generation. Cinematic dark UI, media-rich layout.",
    tokens: {
      pageBackground: "#0a0a0f",
      cardBackground: "#100b1f",
      textColor: "#ffffff",
      headingColor: "#f9fafb",
      accentColor: "#a855f7",
      borderColor: "#32254a",
      quoteBackground: "#28134a",
      codeBackground: "#0d0d12",
      mutedColor: "#ddd6fe",
      fontSize: "15px",
      lineHeight: "1.75",
      h1Size: "36px",
      h2Size: "26px",
      h3Size: "20px",
      fontFamily: "'LXGW WenKai', 'Noto Sans SC', 'PingFang SC', cursive",
      fontFamilyMono: "'DM Mono', 'SF Mono', monospace",
      h1FontFamily: "'LXGW WenKai', 'Noto Sans SC', 'PingFang SC', cursive",
      h2FontFamily: "'LXGW WenKai', 'Noto Sans SC', 'PingFang SC', cursive",
      h3FontFamily: "'LXGW WenKai', 'Noto Sans SC', 'PingFang SC', cursive",
      blockquoteStyle: "background",
      blockquoteTextColor: "#ffffff",
      hrStyle: "gradient",
      cardRadius: "16px",
      cardShadow: "0 8px 32px rgba(168,85,247,0.15)",
      codeTextColor: "#e9d5ff",
      codeBorderRadius: "8px",
      listStyle: "circle",
      paragraphMargin: "0 0 16px",
      sectionMargin: "32px 0",
      h1MarginBottom: "20px",
      h2MarginTop: "32px",
      h2MarginBottom: "16px",
      h3MarginTop: "24px",
      h3MarginBottom: "12px"
    }
  },
  {
    id: "together-ai",
    name: "Together AI",
    description: "Open-source AI infrastructure. Technical, blueprint-style design.",
    tokens: {
      pageBackground: "#f8fafc",
      cardBackground: "#f0f9ff",
      textColor: "#11324a",
      headingColor: "#0b2234",
      accentColor: "#0ea5e9",
      borderColor: "#e0f2fe",
      quoteBackground: "#f0f9ff",
      codeBackground: "#0f172a",
      mutedColor: "#4b6b82",
      fontSize: "15px",
      lineHeight: "1.8",
      h1Size: "36px",
      h2Size: "26px",
      h3Size: "20px",
      fontFamily: "'Ma Shan Zheng', 'Noto Serif SC', 'Source Han Serif SC', cursive",
      fontFamilyMono: "'Space Mono', 'JetBrains Mono', monospace",
      h1FontFamily: "'Ma Shan Zheng', 'Noto Serif SC', 'Source Han Serif SC', cursive",
      h2FontFamily: "'Ma Shan Zheng', 'Noto Serif SC', 'Source Han Serif SC', cursive",
      h3FontFamily: "'Ma Shan Zheng', 'Noto Serif SC', 'Source Han Serif SC', cursive",
      blockquoteStyle: "double-border",
      blockquoteTextColor: "#1e3a5f",
      hrStyle: "gradient",
      cardRadius: "20px",
      cardShadow: "0 4px 20px rgba(14,165,233,0.1)",
      codeTextColor: "#7dd3fc",
      codeBorderRadius: "8px",
      listStyle: "square",
      paragraphMargin: "0 0 14px",
      sectionMargin: "28px 0",
      h1MarginBottom: "20px",
      h2MarginTop: "28px",
      h2MarginBottom: "14px",
      h3MarginTop: "22px",
      h3MarginBottom: "10px"
    }
  }
];

export function listTemplates(): TemplateDefinition[] {
  return templates;
}

export function getTemplateById(templateId: string): TemplateDefinition {
  return templates.find((template) => template.id === templateId) ?? templates[0];
}
