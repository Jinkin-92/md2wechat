import { Route, Routes } from "react-router-dom";

import { LandingPage } from "./pages/LandingPage";
import { PreviewPage } from "./pages/PreviewPage";
import { PublishPage } from "./pages/PublishPage";
import { SettingsPage } from "./pages/SettingsPage";
import { UploadPage } from "./pages/UploadPage";
import { WorkbenchPage } from "./pages/WorkbenchPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/upload" element={<UploadPage />} />
      <Route path="/preview" element={<PreviewPage />} />
      <Route path="/publish" element={<PublishPage />} />
      <Route path="/workbench" element={<WorkbenchPage />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  );
}
