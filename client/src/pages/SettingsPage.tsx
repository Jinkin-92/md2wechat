import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { testAiConnection } from "../lib/api";
import { DEFAULT_SETTINGS, readAppSettings, writeAppSettings } from "../lib/settings";

const TEXT_MODEL_OPTIONS = [
  "MiniMax-M2.7",
  "MiniMax-Text-01",
  "claude-3-5-sonnet-20241022",
  "claude-3-opus-20240229",
  "gpt-4o",
  "gpt-4o-mini"
];

const IMAGE_MODEL_OPTIONS = [
  "image-01",
  "kling-image",
  "dall-e-3",
  "flux-schnell"
];

export function SettingsPage() {
  const navigate = useNavigate();
  const location = useLocation();

  // Text AI
  const [textApiUrl, setTextApiUrl] = useState(DEFAULT_SETTINGS.textApiUrl);
  const [textApiKey, setTextApiKey] = useState(DEFAULT_SETTINGS.textApiKey);
  const [textModel, setTextModel] = useState(DEFAULT_SETTINGS.textModel);

  // Image AI
  const [imageApiUrl, setImageApiUrl] = useState(DEFAULT_SETTINGS.imageApiUrl);
  const [imageApiKey, setImageApiKey] = useState(DEFAULT_SETTINGS.imageApiKey);
  const [imageModel, setImageModel] = useState(DEFAULT_SETTINGS.imageModel);

  // Platform
  const [platformName, setPlatformName] = useState(DEFAULT_SETTINGS.platformName);
  const [originalChecked, setOriginalChecked] = useState(DEFAULT_SETTINGS.originalChecked);

  const [message, setMessage] = useState("");
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    const settings = readAppSettings();
    setTextApiUrl(settings.textApiUrl);
    setTextApiKey(settings.textApiKey);
    setTextModel(settings.textModel);
    setImageApiUrl(settings.imageApiUrl);
    setImageApiKey(settings.imageApiKey);
    setImageModel(settings.imageModel);
    setPlatformName(settings.platformName);
    setOriginalChecked(settings.originalChecked);
  }, []);

  function handleSave() {
    writeAppSettings({
      textApiUrl,
      textApiKey,
      textModel,
      imageApiUrl,
      imageApiKey,
      imageModel,
      platformName,
      originalChecked
    });
    setMessage("设置已保存");
    setTimeout(() => setMessage(""), 2500);
  }

  async function handleTestTextAi() {
    setIsTesting(true);
    setMessage("");
    try {
      const payload = await testAiConnection({
        apiUrl: textApiUrl,
        apiKey: textApiKey,
        model: textModel
      });
      setMessage(payload.message.includes("CONNECTED") ? "文本 AI 连接测试成功" : payload.message);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "连接测试失败");
    } finally {
      setIsTesting(false);
    }
  }

  const backTarget = typeof location.state?.from === "string" ? location.state.from : "/workbench";

  return (
    <div className="settings-page">
      <div className="settings-header">
        <button className="settings-back-btn" onClick={() => navigate(backTarget)}>
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
          返回工作台
        </button>
        <h1 className="settings-title">设置</h1>
      </div>

      <div className="settings-body">
        {/* Text AI */}
        <div className="settings-card">
          <div className="settings-card-header">
            <h2 className="settings-card-title">智能排版 AI（文本模型）</h2>
            <p className="settings-card-desc">用于智能排版、生成摘要、生成封面提示词</p>
          </div>
          <div className="settings-card-body">
            <div className="settings-field">
              <label className="settings-field-label">API URL</label>
              <input
                type="text"
                className="settings-input"
                placeholder="https://api.minimaxi.com/anthropic"
                value={textApiUrl}
                onChange={(event) => setTextApiUrl(event.target.value)}
              />
            </div>
            <div className="settings-field">
              <label className="settings-field-label">API Key</label>
              <input
                type="password"
                className="settings-input"
                placeholder="sk-..."
                value={textApiKey}
                onChange={(event) => setTextApiKey(event.target.value)}
              />
            </div>
            <div className="settings-field">
              <label className="settings-field-label">模型</label>
              <select
                className="settings-select"
                value={textModel}
                onChange={(event) => setTextModel(event.target.value)}
              >
                {TEXT_MODEL_OPTIONS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="settings-save-row settings-save-row-left">
              <button className="settings-account-btn" onClick={() => void handleTestTextAi()} disabled={isTesting}>
                {isTesting ? "测试中..." : "连接测试"}
              </button>
            </div>
          </div>
        </div>

        {/* Image AI */}
        <div className="settings-card">
          <div className="settings-card-header">
            <h2 className="settings-card-title">图像生成 AI</h2>
            <p className="settings-card-desc">用于 AI 生成公众号封面图</p>
          </div>
          <div className="settings-card-body">
            <div className="settings-field">
              <label className="settings-field-label">API URL</label>
              <input
                type="text"
                className="settings-input"
                placeholder="https://api.minimaxi.com"
                value={imageApiUrl}
                onChange={(event) => setImageApiUrl(event.target.value)}
              />
            </div>
            <div className="settings-field">
              <label className="settings-field-label">API Key</label>
              <input
                type="password"
                className="settings-input"
                placeholder="sk-..."
                value={imageApiKey}
                onChange={(event) => setImageApiKey(event.target.value)}
              />
            </div>
            <div className="settings-field">
              <label className="settings-field-label">模型</label>
              <select
                className="settings-select"
                value={imageModel}
                onChange={(event) => setImageModel(event.target.value)}
              >
                {IMAGE_MODEL_OPTIONS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Platform */}
        <div className="settings-card">
          <div className="settings-card-header">
            <h2 className="settings-card-title">公众号信息</h2>
          </div>
          <div className="settings-card-body">
            <div className="settings-field">
              <label className="settings-field-label">公众号名称</label>
              <input
                type="text"
                className="settings-input"
                placeholder="例如：Jinkin遐想"
                value={platformName}
                onChange={(event) => setPlatformName(event.target.value)}
              />
            </div>
            <div className="settings-row">
              <span className="settings-row-label">原创声明</span>
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={originalChecked}
                  onChange={(event) => setOriginalChecked(event.target.checked)}
                />
                <span className="settings-toggle-slider" />
              </label>
            </div>
          </div>
        </div>

        <div className="settings-save-row">
          <button className="settings-save-btn settings-save-btn-wide" onClick={handleSave}>
            保存全部设置
          </button>
          {message ? <span className="settings-inline-message">{message}</span> : null}
        </div>
      </div>
    </div>
  );
}
