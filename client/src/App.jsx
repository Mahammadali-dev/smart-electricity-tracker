import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { api } from "./utils/api";
import { clearSession, loadSession, saveSession } from "./utils/session";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import DashboardPage from "./pages/DashboardPage";

export default function App() {
  const [session, setSession] = useState(() => loadSession());
  const [booting, setBooting] = useState(Boolean(loadSession()?.token));

  useEffect(() => {
    let ignore = false;

    async function hydrateSession() {
      if (!session?.token) {
        setBooting(false);
        return;
      }

      try {
        const data = await api.getUserData(session.token);
        if (ignore) {
          return;
        }

        const nextSession = {
          ...session,
          user: data.user,
          settings: data.settings,
        };
        setSession(nextSession);
        saveSession(nextSession);
      } catch (_error) {
        if (!ignore) {
          clearSession();
          setSession(null);
        }
      } finally {
        if (!ignore) {
          setBooting(false);
        }
      }
    }

    hydrateSession();
    return () => {
      ignore = true;
    };
  }, []);

  function handleAuthSuccess(payload) {
    const nextSession = {
      token: payload.token,
      user: payload.user,
      settings: payload.settings || { dailyLimit: 28, darkMode: true },
    };

    setSession(nextSession);
    saveSession(nextSession);
  }

  function handleLogout() {
    clearSession();
    setSession(null);
  }

  function handleSettingsChange(partialSettings) {
    if (!session) {
      return;
    }

    const nextSession = {
      ...session,
      settings: {
        ...(session.settings || {}),
        ...partialSettings,
      },
    };

    setSession(nextSession);
    saveSession(nextSession);
  }

  if (booting) {
    return (
      <div className="boot-shell">
        <div className="boot-card panel">
          <span className="section-tag">Loading secure session</span>
          <h2>Restoring your smart energy workspace...</h2>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={session?.token ? <Navigate to="/dashboard" replace /> : <LoginPage onSuccess={handleAuthSuccess} />}
      />
      <Route
        path="/signup"
        element={session?.token ? <Navigate to="/dashboard" replace /> : <SignupPage onSuccess={handleAuthSuccess} />}
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute isAuthenticated={Boolean(session?.token)}>
            <DashboardPage session={session} onLogout={handleLogout} onSettingsChange={handleSettingsChange} />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to={session?.token ? "/dashboard" : "/login"} replace />} />
    </Routes>
  );
}
