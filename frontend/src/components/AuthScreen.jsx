import { useState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { api } from "../api";
import { errorText } from "../utils";
import { Field, InlineError } from "./Common";

export function AuthScreen({ onLogin, notify }) {
  const [mode, setMode] = useState("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      if (mode === "register") {
        await api.register(
          form.get("name"),
          form.get("email"),
          form.get("password")
        );
        notify("Account created. Sign in to continue.");
        setMode("login");
      } else {
        const data = await api.login(form.get("email"), form.get("password"));
        onLogin(data.user);
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-brand">
        <div className="brand-mark">Q</div>
        <span>
          queue<span className="brand-dot">.</span>
        </span>
      </div>
      <div className="auth-card">
        <div className="auth-eyebrow">DISTRIBUTED JOB PLATFORM</div>
        <h1>{mode === "login" ? "Welcome back" : "Create account"}</h1>
        <p>
          {mode === "login"
            ? "Sign in to manage and monitor background jobs."
            : "Set up your workspace to process jobs at scale."}
        </p>
        <form onSubmit={submit} className="form-stack">
          {mode === "register" && (
            <Field label="Full name">
              <input
                name="name"
                autoComplete="name"
                placeholder="Alex Developer"
                required
              />
            </Field>
          )}
          <Field label="Email address">
            <input
              name="email"
              type="email"
              autoComplete="email"
              placeholder="alex@example.com"
              required
            />
          </Field>
          <Field label="Password">
            <input
              name="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={6}
              placeholder="••••••••"
              required
            />
          </Field>
          {error && <InlineError>{error}</InlineError>}
          <button className="button primary full" disabled={busy}>
            {busy ? (
              <LoaderCircle className="spin" size={15} />
            ) : (
              <>
                {mode === "login" ? "Sign in" : "Create account"}
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </form>
        <div className="auth-switch">
          {mode === "login" ? "New to Queue?" : "Already have an account?"}{" "}
          <button
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
            }}
          >
            {mode === "login" ? "Create account" : "Sign in"}
          </button>
        </div>
      </div>
      <div className="auth-footer">Secure access · HTTP-only session cookies</div>
    </div>
  );
}

export default AuthScreen;
