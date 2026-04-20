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
  };
};

const templates: TemplateDefinition[] = [
  {
    id: "default-light",
    name: "雾蓝简报",
    description: "偏理性，适合产业观察和技术分析的浅色模板。",
    tokens: {
      pageBackground: "#f3f6f7",
      cardBackground: "#ffffff",
      textColor: "#2b333f",
      headingColor: "#264559",
      accentColor: "#6f92a8",
      borderColor: "#d3dde3",
      quoteBackground: "#edf4f7",
      codeBackground: "#f6f8fa",
      mutedColor: "#667085",
      fontSize: "15px",
      lineHeight: "1.9",
      h1Size: "28px",
      h2Size: "22px",
      h3Size: "18px"
    }
  },
  {
    id: "insight-dark",
    name: "夜读洞察",
    description: "适合长文阅读和趋势评论的深色模板，强调标题与重点段落。",
    tokens: {
      pageBackground: "#14181d",
      cardBackground: "#1c232b",
      textColor: "#eef2f6",
      headingColor: "#f3d38c",
      accentColor: "#d4af66",
      borderColor: "#2c3640",
      quoteBackground: "#202a33",
      codeBackground: "#12171d",
      mutedColor: "#a6b2bf",
      fontSize: "15px",
      lineHeight: "1.95",
      h1Size: "28px",
      h2Size: "22px",
      h3Size: "18px"
    }
  },
  {
    id: "fresh-green",
    name: "清新文摘",
    description: "清新绿底，自然温暖，适合生活方式和成长随笔。",
    tokens: {
      pageBackground: "#f0f7f4",
      cardBackground: "#ffffff",
      textColor: "#2d3a35",
      headingColor: "#1a5c40",
      accentColor: "#4caf82",
      borderColor: "#c8ddd3",
      quoteBackground: "#e8f5ef",
      codeBackground: "#f0faf4",
      mutedColor: "#6b8c7d",
      fontSize: "15px",
      lineHeight: "1.9",
      h1Size: "28px",
      h2Size: "22px",
      h3Size: "18px"
    }
  },
  {
    id: "warm-peach",
    name: "暖阳随笔",
    description: "暖橙色调，温和亲切，适合生活记录和情感文字。",
    tokens: {
      pageBackground: "#fff8f3",
      cardBackground: "#ffffff",
      textColor: "#3d2e2a",
      headingColor: "#a85424",
      accentColor: "#e8874e",
      borderColor: "#f0d9c8",
      quoteBackground: "#fff0e8",
      codeBackground: "#fef5f0",
      mutedColor: "#8c7060",
      fontSize: "15px",
      lineHeight: "1.9",
      h1Size: "28px",
      h2Size: "22px",
      h3Size: "18px"
    }
  },
  {
    id: "minimal-gray",
    name: "极简主义",
    description: "黑白灰极简，突出内容，适合产品设计和方法论文章。",
    tokens: {
      pageBackground: "#ffffff",
      cardBackground: "#ffffff",
      textColor: "#1a1a1a",
      headingColor: "#000000",
      accentColor: "#666666",
      borderColor: "#e5e5e5",
      quoteBackground: "#f5f5f5",
      codeBackground: "#fafafa",
      mutedColor: "#999999",
      fontSize: "16px",
      lineHeight: "1.85",
      h1Size: "30px",
      h2Size: "23px",
      h3Size: "18px"
    }
  },
  {
    id: "sunset",
    name: "落日暖调",
    description: "暖红渐变，情感强烈，适合个人品牌和观点表达。",
    tokens: {
      pageBackground: "#fff5f5",
      cardBackground: "#ffffff",
      textColor: "#3d2020",
      headingColor: "#c0392b",
      accentColor: "#e74c3c",
      borderColor: "#f5d5d5",
      quoteBackground: "#fff0f0",
      codeBackground: "#fef6f6",
      mutedColor: "#8c6060",
      fontSize: "15px",
      lineHeight: "1.9",
      h1Size: "28px",
      h2Size: "22px",
      h3Size: "18px"
    }
  }
];

export function listTemplates(): TemplateDefinition[] {
  return templates;
}

export function getTemplateById(templateId: string): TemplateDefinition {
  return templates.find((template) => template.id === templateId) ?? templates[0];
}
