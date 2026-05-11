export type HealthStatus = {
  status: "ok";
  service: string;
  timestamp: string;
};

export type AppConfig = {
  port: number;
  corsOrigin: string;
  dataDir: string;
  wechatBaseUrl: string;
};

export type ArticleStatus = "draft" | "rendered" | "uploading" | "done" | "error";

export type ArticleBodyImageAsset = {
  id: string;
  placeholder: string;
  label: string;
  markerToken: string;
  localPath: string | null;
  storageKey: string | null;
};

export type ArticleMediaAssets = {
  coverLocalPath: string | null;
  coverStorageKey: string | null;
  bodyImages: ArticleBodyImageAsset[];
};

export type ArticleRecord = {
  id: string;
  title: string;
  sourceFileName: string;
  rawMarkdown: string;
  templateId: string | null;
  renderedHtml: string | null;
  coverImage: {
    localPath: string | null;
    wechatMediaId: string | null;
  };
  metadata: {
    author: string;
    digest: string;
    wordCount: number;
    originalChecked: boolean;
  };
  mediaAssets: ArticleMediaAssets;
  status: ArticleStatus;
  createdAt: string;
  updatedAt: string;
};

export type ArticleSummary = Omit<ArticleRecord, "rawMarkdown" | "renderedHtml">;

export type PublishAccountStatus = "ready" | "expired" | "offline";

export type PublishLoginProbe = {
  pageTitle: string;
  finalUrl: string;
  screenshotPath: string;
  loginState: "authenticated" | "login_required";
  usedStoredSession: boolean;
};

export type PublishDraftProbe = {
  pageTitle: string;
  finalUrl: string;
  screenshotPath: string;
  backendReachable: boolean;
  usedStoredSession: boolean;
  draftEntryDetected: boolean;
  matchedSelector: string | null;
  editorReachable: boolean;
  editorUrl: string | null;
  matchedTitleSelector: string | null;
};

export type PublishAccount = {
  id: string;
  name: string;
  status: PublishAccountStatus;
  lastValidatedAt: string | null;
  note: string;
  hasStoredSession: boolean;
  sessionFilePath: string | null;
  latestLoginProbe?: PublishLoginProbe | null;
  latestDraftProbe?: PublishDraftProbe | null;
};

export type PublishTaskStatus = "pending" | "running" | "success" | "failed";

export type PublishTaskStep = {
  key: string;
  label: string;
  status: PublishTaskStatus;
  detail: string;
};

export type PublishTaskResult = {
  saveScreenshotPath: string | null;
  reopenScreenshotPath: string | null;
  reopenUrl: string | null;
  saveSuccessText: string | null;
  coverImageApplied: boolean;
  coverImagePath: string | null;
  insertedBodyImagePaths: string[];
  missingBodyImagePaths: string[];
  reopenRichTextPreserved: boolean;
};

export type PublishTask = {
  id: string;
  articleId: string;
  accountId: string;
  draftAppmsgId: string | null;
  result: PublishTaskResult | null;
  status: PublishTaskStatus;
  createdAt: string;
  updatedAt: string;
  steps: PublishTaskStep[];
};
