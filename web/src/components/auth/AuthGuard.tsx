import React, { useEffect, useState } from "react";
import { useAuthStore } from "../../stores/authStore";
import LoginPage from "./LoginPage";
import RegisterPage from "./RegisterPage";

interface Props {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: Props) {
  const { isAuthenticated, token, fetchMe, loading } = useAuthStore();
  const [authView, setAuthView] = useState<"login" | "register">("login");

  useEffect(() => {
    if (token && !isAuthenticated) {
      fetchMe();
    }
  }, [token, isAuthenticated, fetchMe]);

  if (loading && token) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <p style={{ textAlign: "center", color: "var(--muted)" }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (authView === "register") {
      return <RegisterPage onSwitchToLogin={() => setAuthView("login")} />;
    }
    return <LoginPage onSwitchToRegister={() => setAuthView("register")} />;
  }

  return <>{children}</>;
}
