import { useEffect, useState } from "react";
import { Route, Routes, Link } from "react-router";
import { getHealth } from "./api/client";
import ProjectsPage from "./pages/ProjectsPage";
import ProjectDetailPage from "./pages/ProjectDetailPage";

function HealthBadge() {
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        await getHealth();
        if (!cancelled) setOk(true);
      } catch {
        if (!cancelled) setOk(false);
      }
    }

    check();
    const interval = setInterval(check, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (ok === null) return null;

  return (
    <span className={`badge ${ok ? "badge-ok" : "badge-error"}`}>
      API {ok ? "ok" : "unreachable"}
    </span>
  );
}

export default function App() {
  return (
    <>
      <header className="app-header">
        <h1>
          <Link to="/">Helix</Link>
        </h1>
        <HealthBadge />
      </header>
      <div className="container">
        <Routes>
          <Route path="/" element={<ProjectsPage />} />
          <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        </Routes>
      </div>
    </>
  );
}
