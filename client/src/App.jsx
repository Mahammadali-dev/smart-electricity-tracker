import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { api } from "./utils/api";
import { clearSession, loadSession, saveSession } from "./utils/session";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import DashboardPage from "./pages/DashboardPage";
import SetupPage from "./pages/SetupPage";

export default function App() {
  const persistedSession = loadSession();
  const [session, setSession] = useState(() => persistedSession);
  const [booting, setBooting] = useState(Boolean(persistedSession?.token));
  const persistedSetupCompleted = Boolean(persistedSession?.setupCompleted);

  useEffect(() => {
    const darkMode = session?.settings?.darkMode !== false;
    document.body.classList.toggle("theme-dark", darkMode);
    document.body.classList.toggle("theme-light", !darkMode);
  }, [session?.settings?.darkMode]);

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
          settings: data.settings || session.settings || { dailyLimit: 28, darkMode: true },
          setupCompleted: Boolean(data.setupCompleted),
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
      setupCompleted: Boolean(payload.setupCompleted),
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

  function handleUserUpdate(partialUser, nextToken) {
    if (!session) {
      return;
    }

    const nextSession = {
      ...session,
      token: nextToken || session.token,
      user: {
        ...(session.user || {}),
        ...partialUser,
      },
    };

    setSession(nextSession);
    saveSession(nextSession);
  }

  function handleSetupComplete(partial = {}) {
    if (!session) {
      return;
    }

    const nextSession = {
      ...session,
      setupCompleted: true,
      settings: {
        ...(session.settings || {}),
        ...(partial.settings || {}),
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

  const hasCompletedSetup = Boolean(session?.setupCompleted || persistedSetupCompleted);
  const defaultProtectedPath = session?.token ? (hasCompletedSetup ? "/dashboard" : "/setup") : "/login";

  return (
    <Routes>
      <Route
        path="/login"
        element={session?.token ? <Navigate to={defaultProtectedPath} replace /> : <LoginPage onSuccess={handleAuthSuccess} />}
      />
      <Route
        path="/signup"
        element={session?.token ? <Navigate to={defaultProtectedPath} replace /> : <SignupPage onSuccess={handleAuthSuccess} />}
      />
      <Route
        path="/setup"
        element={
          <ProtectedRoute isAuthenticated={Boolean(session?.token)}>
            <SetupPage
              session={session}
              onLogout={handleLogout}
              onSetupComplete={handleSetupComplete}
              onSettingsChange={handleSettingsChange}
            />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute isAuthenticated={Boolean(session?.token)}>
            {hasCompletedSetup ? (
              <DashboardPage
                session={session}
                onLogout={handleLogout}
                onSettingsChange={handleSettingsChange}
                onUserUpdate={handleUserUpdate}
              />
            ) : (
              <Navigate to="/setup" replace />
            )}
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to={defaultProtectedPath} replace />} />
    </Routes>
  );
}
