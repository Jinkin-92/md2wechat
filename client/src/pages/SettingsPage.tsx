import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { fetchDetectedAgents, testAiConnection, testImageAiConnection } from "../lib/api";
import type { DetectedAgent } from "../lib/api";
import { DEFAULT_SETTINGS, readAppSettings, writeAppSettings } from "../lib/settings";

function ModelInput(props: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="settings-field">
      <label className="settings-field-label">{props.label}</label>
      <input
        type="text"
        className="settings-input"
        placeholder="手动填写模型名称"
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </div>
  );
}

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

  // AI Engine
  const [aiEngine, setAiEngine] = useState(DEFAULT_SETTINGS.aiEngine);
  const [detectedAgents, setDetectedAgents] = useState<DetectedAgent[]>([]);

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
    setAiEngine(settings.aiEngine);

    // 检测已安装的 CLI
    fetchDetectedAgents()
      .then(setDetectedAgents)
      .catch(() => setDetectedAgents([]));
  }, []);

  function handleSave() {
    writeAppSettings({
      aiEngine,
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

  async function handleTestImageAi() {
    setIsTesting(true);
    setMessage("");
    try {
      const payload = await testImageAiConnection({
        apiUrl: imageApiUrl,
        apiKey: imageApiKey,
        model: imageModel
      });
      setMessage(payload.message.includes("CONNECTED") ? "图像 AI 连接测试成功" : payload.message);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "图像 AI 连接测试失败");
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
        {/* AI Engine Selector */}
        <div className="settings-card">
          <div className="settings-card-header">
            <h2 className="settings-card-title">AI 引擎</h2>
            <p className="settings-card-desc">选择智能排版使用的 AI 引擎</p>
          </div>
          <div className="settings-card-body">
            <div className="settings-field">
              <label className="settings-field-label">引擎类型</label>
              <select
                className="settings-input"
                value={aiEngine}
                onChange={(event) => setAiEngine(event.target.value as typeof aiEngine)}
              >
                <option value="api">API 模式（需要 API Key）</option>
                <option value="claude">Claude Code（本地 CLI）</option>
                <option value="cursor">Cursor Agent（本地 CLI）</option>
                <option value="gemini">Gemini CLI（本地 CLI）</option>
                <option value="copilot">GitHub Copilot（本地 CLI）</option>
                <option value="opencode">OpenCode（本地 CLI）</option>
                <option value="qwen">Qwen Coder（本地 CLI）</option>
                <option value="aider">Aider（本地 CLI）</option>
                <option value="kimi">Kimi Code（本地 CLI）</option>
                <option value="codex">OpenAI Codex（本地 CLI）</option>
              </select>
            </div>
            {aiEngine !== "api" && (
              <div className="settings-field">
                <label className="settings-field-label">本地 CLI 状态</label>
                <div className="settings-agents-list">
                  {detectedAgents.length === 0 ? (
                    <span className="settings-agent-checking">正在检测...</span>
                  ) : detectedAgents.filter((a) => a.id === aiEngine).map((agent) => (
                    <span
                      key={agent.id}
                      className={`settings-agent-badge ${agent.installed ? "installed" : "not-installed"}`}
                    >
                      {agent.name}: {agent.installed ? "已连接" : "未检测到"}
                    </span>
                  ))}
                </div>
                <p className="settings-card-desc" style={{ marginTop: "8px" }}>
                  {aiEngine !== "api"
                    ? "使用本地已登录的 CLI 会话，无需 API Key，零成本。"
                    : "使用第三方 API，需要配置 API Key。"}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Text AI - 仅 API 模式显示 */}
        {aiEngine === "api" && (
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
              <ModelInput
                label="模型"
                value={textModel}
                onChange={setTextModel}
              />
              <div className="settings-save-row settings-save-row-left">
                <button className="settings-account-btn" onClick={() => void handleTestTextAi()} disabled={isTesting}>
                  {isTesting ? "测试中..." : "连接测试"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Image AI */}
        {aiEngine === "api" && (
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
            <ModelInput
              label="模型"
              value={imageModel}
              onChange={setImageModel}
            />
            <div className="settings-save-row settings-save-row-left">
              <button className="settings-account-btn" onClick={() => void handleTestImageAi()} disabled={isTesting}>
                {isTesting ? "测试中..." : "连接测试"}
              </button>
            </div>
          </div>
        )}

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
