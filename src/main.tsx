import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import "./index.css";
import Layout from "./components/Layout";
import ScanHomePage from "./pages/ScanHomePage";
import DashboardPage from "./pages/DashboardPage";
import WebsitePage from "./pages/WebsitePage";
import ScanPage from "./pages/ScanPage";
import FindingsPage from "./pages/FindingsPage";
import FindingPage from "./pages/FindingPage";
import ReportsPage from "./pages/ReportsPage";
import ReportPage from "./pages/ReportPage";
import ActivityPage from "./pages/ActivityPage";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route index element={<ScanHomePage />} />
        <Route element={<Layout />}>
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="websites/:id" element={<WebsitePage />} />
          <Route path="scans/:id" element={<ScanPage />} />
          <Route path="findings" element={<FindingsPage />} />
          <Route path="findings/:id" element={<FindingPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="reports/:id" element={<ReportPage />} />
          <Route path="activity" element={<ActivityPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
