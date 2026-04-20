import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const CONFIG_KEY = "mdpublisher_settings";

interface UserConfig {
  aiEnabled: boolean;
  smartTypesettingEnabled: boolean;
  learningTemplateEnabled: boolean;
  modelProvider: string;
  apiUrl: string;
  apiKey: string;
  modelVersion: string;
  smartIntensity: string;
  referencePlatform: string;
}

const defaultConfig: UserConfig = {
  aiEnabled: false,
  smartTypesettingEnabled: false,
  learningTemplateEnabled: false,
  modelProvider: "openai",
  apiUrl: "",
  apiKey: "",
  modelVersion: "",
  smartIntensity: "standard",
  referencePlatform: "wechat"
};

export function SettingsPage() {
  const navigate = useNavigate();
  const [aiEnabled, setAiEnabled] = useState(defaultConfig.aiEnabled);
  const [smartTypesettingEnabled, setSmartTypesettingEnabled] = useState(defaultConfig.smartTypesettingEnabled);
  const [learningTemplateEnabled, setLearningTemplateEnabled] = useState(defaultConfig.learningTemplateEnabled);
  const [modelProvider, setModelProvider] = useState(defaultConfig.modelProvider);
  const [apiUrl, setApiUrl] = useState(defaultConfig.apiUrl);
  const [apiKey, setApiKey] = useState(defaultConfig.apiKey);
  const [modelVersion, setModelVersion] = useState(defaultConfig.modelVersion);
  const [smartIntensity, setSmartIntensity] = useState(defaultConfig.smartIntensity);
  const [referencePlatform, setReferencePlatform] = useState(defaultConfig.referencePlatform);
  const [message, setMessage] = useState("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CONFIG_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<UserConfig>;
        if (parsed.aiEnabled !== undefined) setAiEnabled(parsed.aiEnabled);
        if (parsed.smartTypesettingEnabled !== undefined) setSmartTypesettingEnabled(parsed.smartTypesettingEnabled);
        if (parsed.learningTemplateEnabled !== undefined) setLearningTemplateEnabled(parsed.learningTemplateEnabled);
        if (parsed.modelProvider !== undefined) setModelProvider(parsed.modelProvider);
        if (parsed.apiUrl !== undefined) setApiUrl(parsed.apiUrl);
        if (parsed.apiKey !== undefined) setApiKey(parsed.apiKey);
        if (parsed.modelVersion !== undefined) setModelVersion(parsed.modelVersion);
        if (parsed.smartIntensity !== undefined) setSmartIntensity(parsed.smartIntensity);
        if (parsed.referencePlatform !== undefined) setReferencePlatform(parsed.referencePlatform);
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  function handleSave() {
    const config: UserConfig = {
      aiEnabled,
      smartTypesettingEnabled,
      learningTemplateEnabled,
      modelProvider,
      apiUrl,
      apiKey,
      modelVersion,
      smartIntensity,
      referencePlatform
    };
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    setMessage("设置已保存");
    setTimeout(() => setMessage(""), 3000);
  }

  function handleAccountConnect(platform: string) {
    if (platform === "wechat") {
      alert("微信连接：扫码登录功能即将上线，请关注后续更新。");
    } else if (platform === "zhihu") {
      alert("知乎连接：OAuth 登录功能即将上线。");
    } else if (platform === "jianshu") {
      alert("简书连接：OAuth 登录功能即将上线。");
    }
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <button className="settings-back-btn" onClick={() => navigate("/")}>
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
          返回
        </button>
        <h1 className="settings-title">设置</h1>
      </div>

      <div className="settings-body">
        {/* AI 功能 */}
        <div className="settings-card">
          <div className="settings-card-header">
            <h2 className="settings-card-title">AI 功能</h2>
          </div>
          <div className="settings-card-body">
            <div className="settings-row">
              <div className="settings-row-label">启用 AI 助手</div>
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={aiEnabled}
                  onChange={(e) => setAiEnabled(e.target.checked)}
                />
                <span className="settings-toggle-slider" />
              </label>
            </div>

            {aiEnabled && (
              <div className="settings-ai-fields">
                <div className="settings-field">
                  <label className="settings-field-label">模型选择</label>
                  <select
                    className="settings-select"
                    value={modelProvider}
                    onChange={(e) => setModelProvider(e.target.value)}
                  >
                    <option value="openai">GPT-4</option>
                    <option value="claude">Claude-3</option>
                    <option value="local">本地模型</option>
                  </select>
                </div>
                <div className="settings-field">
                  <label className="settings-field-label">API URL</label>
                  <input
                    type="text"
                    className="settings-input"
                    placeholder="https://api.openai.com/v1"
                    value={apiUrl}
                    onChange={(e) => setApiUrl(e.target.value)}
                  />
                </div>
                <div className="settings-field">
                  <label className="settings-field-label">API Key</label>
                  <input
                    type="password"
                    className="settings-input"
                    placeholder="sk-..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                </div>
                <div className="settings-field">
                  <label className="settings-field-label">模型版本</label>
                  <input
                    type="text"
                    className="settings-input"
                    placeholder="gpt-4-turbo"
                    value={modelVersion}
                    onChange={(e) => setModelVersion(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 智能排版设置 */}
        <div className="settings-card">
          <div className="settings-card-header">
            <h2 className="settings-card-title">智能排版设置</h2>
          </div>
          <div className="settings-card-body">
            <div className="settings-row">
              <div className="settings-row-label">启用智能排版</div>
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={smartTypesettingEnabled}
                  onChange={(e) => setSmartTypesettingEnabled(e.target.checked)}
                />
                <span className="settings-toggle-slider" />
              </label>
            </div>
            {smartTypesettingEnabled && (
              <div className="settings-intensity">
                <div className="settings-row-label" style={{ marginBottom: "12px" }}>排版强度</div>
                <div className="settings-intensity-btns">
                  {["light", "standard", "deep"].map((intensity) => (
                    <button
                      key={intensity}
                      className={`settings-intensity-btn ${smartIntensity === intensity ? "active" : ""}`}
                      onClick={() => setSmartIntensity(intensity)}
                    >
                      {intensity === "light" ? "微调" : intensity === "standard" ? "标准" : "深度"}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 学习模板设置 */}
        <div className="settings-card">
          <div className="settings-card-header">
            <h2 className="settings-card-title">学习模板设置</h2>
          </div>
          <div className="settings-card-body">
            <div className="settings-row">
              <div className="settings-row-label">启用学习模板</div>
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={learningTemplateEnabled}
                  onChange={(e) => setLearningTemplateEnabled(e.target.checked)}
                />
                <span className="settings-toggle-slider" />
              </label>
            </div>
            {learningTemplateEnabled && (
              <div className="settings-field" style={{ marginTop: "16px" }}>
                <label className="settings-field-label">参考平台</label>
                <select
                  className="settings-select"
                  value={referencePlatform}
                  onChange={(e) => setReferencePlatform(e.target.value)}
                >
                  <option value="wechat">微信原生</option>
                  <option value="zhihu">知乎</option>
                  <option value="jianshu">简书</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* 账号管理 */}
        <div className="settings-card">
          <div className="settings-card-header">
            <h2 className="settings-card-title">账号管理</h2>
          </div>
          <div className="settings-card-body">
            <div className="settings-account-row">
              <div className="settings-account-info">
                <span className="settings-account-platform">微信</span>
                <span className="settings-account-status disconnected">未连接</span>
              </div>
              <button className="settings-account-btn" onClick={() => handleAccountConnect("wechat")}>连接</button>
            </div>
            <div className="settings-account-row">
              <div className="settings-account-info">
                <span className="settings-account-platform">知乎</span>
                <span className="settings-account-status disconnected">未连接</span>
              </div>
              <button className="settings-account-btn" onClick={() => handleAccountConnect("zhihu")}>连接</button>
            </div>
            <div className="settings-account-row">
              <div className="settings-account-info">
                <span className="settings-account-platform">简书</span>
                <span className="settings-account-status disconnected">未连接</span>
              </div>
              <button className="settings-account-btn" onClick={() => handleAccountConnect("jianshu")}>连接</button>
            </div>
          </div>
        </div>

        {/* Save */}
        <div className="settings-save-row">
          {message && <span style={{ color: "var(--green)", fontSize: "14px" }}>{message}</span>}
          <button className="settings-save-btn" onClick={handleSave}>保存设置</button>
        </div>
      </div>
    </div>
  );
}
