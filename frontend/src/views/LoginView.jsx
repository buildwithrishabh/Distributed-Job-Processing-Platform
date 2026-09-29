import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { Button } from "../components/ui/Button.jsx";
import { Alert } from "../components/ui/Feedback.jsx";
import { PasswordInput, Input } from "../components/ui/Field.jsx";
import { Icons } from "../components/ui/Icons.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useConfig } from "../context/ConfigContext.jsx";
import { ApiError } from "../lib/api/errors.js";
import { probeHealth } from "../lib/api/client.js";

/**
 * Sign-in screen.
 *
 * Deliberately does not live behind the app shell: there is nothing to see
 * without a session, and rendering the chrome first just flashes an empty
 * dashboard on every cold load.
 */
export function LoginView() {
  const { signIn, signUp } = useAuth();
  const { originLabel, setTheme, theme } = useConfig();
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [apiOnline, setApiOnline] = useState(null);

  // Warn early if the API is not reachable — a failed login is otherwise
  // indistinguishable from wrong credentials.
  const checkApi = async () => {
    const result = await probeHealth();
    setApiOnline(result.online);
  };

  const validate = () => {
    const errors = {};
    if (!email.trim()) errors.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = "That does not look like a valid email address.";
    }
    if (!password) errors.password = "Password is required.";
    else if (mode === "signup" && password.length < 8) {
      errors.password = "Use at least 8 characters.";
    }
    if (mode === "signup" && !name.trim()) errors.name = "Name is required.";

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      if (mode === "signin") {
        await signIn({ email: email.trim(), password });
      } else {
        await signUp({ name: name.trim(), email: email.trim(), password });
      }
      const from = location.state?.from;
      navigate(from?.pathname ?? "/", { replace: true });
    } catch (caught) {
      if (caught instanceof ApiError) {
        setFieldErrors(
          Object.fromEntries(caught.details.map((detail) => [detail.field, detail.message])),
        );
        setError(caught.displayMessage);
      } else {
        setError("Could not reach the API. Check the endpoint in Settings.");
      }
      void checkApi();
    } finally {
      setSubmitting(false);
    }
  };

  const isSignup = mode === "signup";

  return (
    <div className="auth">
      <button
        type="button"
        className="btn btn--ghost btn--sm btn--icon auth__theme"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      >
        {theme === "dark" ? <Icons.sun size={16} /> : <Icons.moon size={16} />}
      </button>

      <div className="auth__panel">
        <div className="auth__brand">
          <span className="brand-mark" style={{ width: 40, height: 40 }} aria-hidden="true">
            <Icons.layers size={22} />
          </span>
          <div>
            <div className="brand-text__name" style={{ fontSize: "var(--text-xl)" }}>
              Queue<em>Forge</em>
            </div>
            <div className="brand-text__tag">Job control console</div>
          </div>
        </div>

        <div className="auth__intro">
          <h1 className="auth__title">{isSignup ? "Create an account" : "Sign in"}</h1>
          <p className="auth__lede">
            {isSignup
              ? "Register to start submitting and monitoring jobs."
              : "Access the queue dashboard, job history, and worker health."}
          </p>
        </div>

        {apiOnline === false ? (
          <Alert tone="danger" title="The API is not responding">
            The console cannot reach <span className="mono">{originLabel}</span>. Start the backend, then
            sign in again.
          </Alert>
        ) : null}

        {error ? (
          <Alert tone="danger" title="Sign in failed">
            {error}
          </Alert>
        ) : null}

        <form className="auth__form" onSubmit={submit} noValidate>
          {isSignup ? (
            <Input
              label="Name"
              required
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              error={fieldErrors.name}
              disabled={submitting}
            />
          ) : null}

          <Input
            label="Email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={fieldErrors.email}
            disabled={submitting}
            placeholder="you@example.com"
          />

          <PasswordInput
            label="Password"
            required
            autoComplete={isSignup ? "new-password" : "current-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={fieldErrors.password}
            hint={isSignup ? "At least 8 characters." : undefined}
            disabled={submitting}
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            block
            loading={submitting}
            icon={isSignup ? <Icons.user size={16} /> : <Icons.login size={16} />}
          >
            {isSignup ? "Create account" : "Sign in"}
          </Button>
        </form>

        <div className="auth__switch">
          {isSignup ? "Already have an account?" : "No account yet?"}{" "}
          <button
            type="button"
            className="auth__link"
            onClick={() => {
              setMode(isSignup ? "signin" : "signup");
              setError(null);
              setFieldErrors({});
            }}
          >
            {isSignup ? "Sign in" : "Create one"}
          </button>
        </div>

        <p className="auth__meta">
          Connecting to <span className="mono">{originLabel}</span> · change this in{" "}
          <a className="auth__link" href="/settings" onClick={(event) => {
            event.preventDefault();
            setMode("signin");
          }}>
            Settings
          </a>{" "}
          after signing in.
        </p>
      </div>
    </div>
  );
}
