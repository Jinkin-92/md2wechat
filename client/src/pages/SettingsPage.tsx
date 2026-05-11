import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { testAiConnection } from "../lib/api";
import { DEFAULT_SETTINGS, readAppSettings, writeAppSettings } from "../lib/settings";

export function SettingsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [apiUrl, setApiUrl] = useState(DEFAULT_SETTINGS.apiUrl);
  const [apiKey, setApiKey] = useState(DEFAULT_SETTINGS.apiKey);
  const [platformName, setPlatformName] = useState(DEFAULT_SETTINGS.platformName);
  const [originalChecked, setOriginalChecked] = useState(DEFAULT_SETTINGS.originalChecked);
  const [message, setMessage] = useState("");
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    const settings = readAppSettings();
    setApiUrl(settings.apiUrl);
    setApiKey(settings.apiKey);
    setPlatformName(settings.platformName);
    setOriginalChecked(settings.originalChecked);
  }, []);

  function handleSave() {
    writeAppSettings({ apiUrl, apiKey, platformName, originalChecked });
    setMessage("设置已保存");
    setTimeout(() => setMessage(""), 2500);
  }

  async function handleTest() {
    setIsTesting(true);
    setMessage("");
    try {
      const settings = writeAppSettings({ apiUrl, apiKey });
      const payload = await testAiConnection(settings);
      setMessage(payload.message.includes("CONNECTED") ? "连接测试成功" : payload.message);
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
        <div className="settings-card">
          <div className="settings-card-header">
            <h2 className="settings-card-title">智能排版连接</h2>
          </div>
          <div className="settings-card-body">
            <div className="settings-field">
              <label className="settings-field-label">API URL</label>
              <input
                type="text"
                className="settings-input"
                value={apiUrl}
                onChange={(event) => setApiUrl(event.target.value)}
              />
            </div>
            <div className="settings-field">
              <label className="settings-field-label">API Key</label>
              <input
                type="password"
                className="settings-input"
                placeholder="sk-..."
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
              />
            </div>
            <div className="settings-save-row settings-save-row-left">
              <button className="settings-account-btn" onClick={() => void handleTest()} disabled={isTesting}>
                {isTesting ? "测试中..." : "连接测试"}
              </button>
              <button className="settings-save-btn" onClick={handleSave}>
                保存设置
              </button>
            </div>
            {message ? <span className="settings-inline-message">{message}</span> : null}
          </div>
        </div>

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
            <div className="settings-save-row settings-save-row-left">
              <button className="settings-save-btn" onClick={handleSave}>
                保存设置
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
