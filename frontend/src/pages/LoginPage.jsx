import React, { useState } from 'react';
import { useNavigate, useLocation, Navigate, Link } from 'react-router-dom';
import {
  Lock,
  Mail,
  User,
  Zap,
  Cpu,
  Eye,
  EyeOff,
  Layers,
  ShieldCheck,
  Activity,
  AlertCircle,
  CheckCircle2,
  Server,
  ArrowRight,
  LogIn,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../api/client';

const DEMO_EMAIL = 'admin@jobplatform.com';
const DEMO_PASSWORD = 'Password123!';

const PIPELINE = [
  { icon: Zap, label: 'Dispatch', sub: 'Express API', variant: '' },
  { icon: Layers, label: 'Queue', sub: 'Redis · BullMQ', variant: 'redis' },
  { icon: Server, label: 'Process', sub: 'Worker pool', variant: 'worker' },
];

const FACTS = [
  {
    icon: Layers,
    cls: 'fact-ico--queue',
    title: 'BullMQ / Redis queues',
    desc: 'Asynchronous dispatch with concurrency control.',
  },
  {
    icon: ShieldCheck,
    cls: 'fact-ico--auth',
    title: 'HttpOnly JWT sessions',
    desc: 'Auto-rotating access tokens with silent refresh.',
  },
  {
    icon: Activity,
    cls: 'fact-ico--live',
    title: 'Live telemetry & DLQ',
    desc: 'Worker heartbeats and one-click dead-letter recovery.',
  },
];

export default function LoginPage() {
  const { login, register, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/';

  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (isAuthenticated) return <Navigate to={from} replace />;

  const switchMode = (next) => {
    setMode(next);
    setErrorMsg('');
    setInfoMsg('');
  };

  const fillDemo = () => {
    setEmail(DEMO_EMAIL);
    setPassword(DEMO_PASSWORD);
    if (mode === 'register') setName('Admin User');
    setErrorMsg('');
    setInfoMsg('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');
    setIsLoading(true);
    try {
      if (mode === 'register') {
        await register({ name, email, password });
        setMode('login');
        setPassword('');
        setInfoMsg('Account created successfully! Please log in with your credentials.');
      } else {
        await login({ email, password });
        navigate(from, { replace: true });
      }
    } catch (err) {
      setErrorMsg(getErrorMessage(err, 'Authentication failed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-glow auth-glow-1" />
      <div className="auth-glow auth-glow-2" />
      <div className="auth-grid" />

      <div className="auth-shell fade-in">
        <section className="auth-showcase">
          <div className="brand-lockup">
            <div className="brand-mark">
              <Cpu size={24} />
            </div>
            <div className="brand-words">
              <div className="brand-title">JobOrchestrator</div>
              <div className="brand-subtitle">Distributed Queue Control Center</div>
            </div>
          </div>

          <div>
            <h1 className="auth-title">
              Queue it. <span className="text-gradient">Process it.</span>
              <br />
              Track everything live.
            </h1>
            <p className="auth-sub">
              Dispatch background jobs into a Redis BullMQ cluster, auto-scale worker
              consumers, and watch retries, dead-letter recovery &amp; telemetry in real time.
            </p>
          </div>

          <div className="pipeline" role="list" aria-label="Job processing pipeline">
            {PIPELINE.map((s, i) => (
              <React.Fragment key={s.label}>
                {i > 0 && (
                  <span className="pipe-link" aria-hidden="true">
                    <ArrowRight size={14} />
                  </span>
                )}
                <div className="pipe-stage" role="listitem">
                  <span className={`pipe-ico ${s.variant ? `pipe-ico--${s.variant}` : ''}`}>
                    <s.icon size={18} />
                  </span>
                  <span className="pipe-text">
                    <strong>{s.label}</strong>
                    <small>{s.sub}</small>
                  </span>
                </div>
              </React.Fragment>
            ))}
          </div>

          <div className="auth-facts">
            {FACTS.map((f) => (
              <div className="fact" key={f.title}>
                <span className={`fact-ico ${f.cls}`}>
                  <f.icon size={17} />
                </span>
                <div className="min-w-0">
                  <strong>{f.title}</strong>
                  <p>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="auth-card-wrap">
          <div className="auth-card fade-in">
            <div className="auth-card-head">
              <h2 className="auth-card-h">
                {mode === 'login' ? 'Welcome back' : 'Create account'}
              </h2>
              <p className="auth-card-s">
                {mode === 'login'
                  ? 'Sign in to access your queue metrics and cluster logs.'
                  : 'Set up your credentials to start dispatching jobs.'}
              </p>
            </div>

            <div className="auth-tabs">
              <button
                type="button"
                className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
                onClick={() => switchMode('login')}
              >
                Sign In
              </button>
              <button
                type="button"
                className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
                onClick={() => switchMode('register')}
              >
                Register
              </button>
            </div>

            {errorMsg && (
              <div className="auth-banner error" role="alert">
                <AlertCircle size={16} className="banner-icon" />
                <span>{errorMsg}</span>
              </div>
            )}
            {infoMsg && (
              <div className="auth-banner success" role="status">
                <CheckCircle2 size={16} className="banner-icon" />
                <span>{infoMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              {mode === 'register' && (
                <div className="form-group">
                  <label className="form-label" htmlFor="auth-name">Full Name</label>
                  <div className="input-icon">
                    <User size={18} />
                    <input
                      id="auth-name"
                      type="text"
                      className="form-input"
                      placeholder="Your full name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      autoComplete="name"
                    />
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label" htmlFor="auth-email">Email Address</label>
                <div className="input-icon">
                  <Mail size={18} />
                  <input
                    id="auth-email"
                    type="email"
                    className="form-input"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="auth-password">Password</label>
                <div className="input-icon">
                  <Lock size={18} />
                  <input
                    id="auth-password"
                    type={showPw ? 'text' : 'password'}
                    className="form-input password-input"
                    placeholder={mode === 'register' ? 'At least 8 characters' : 'Enter your password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={mode === 'register' ? 8 : undefined}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((s) => !s)}
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                    className="password-toggle"
                  >
                    {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="auth-form-tools">
                <span className="demo-caption">Try the demo</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm demo-fill-btn"
                  onClick={fillDemo}
                >
                  <Zap size={14} /> Fill demo credentials
                </button>
              </div>

              <button type="submit" className="btn btn-primary btn-block auth-submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <span className="spinner" aria-hidden="true" /> Authenticating...
                  </>
                ) : (
                  <>
                    <LogIn size={17} />
                    {mode === 'register' ? 'Create Account' : 'Sign In'}
                  </>
                )}
              </button>
            </form>

            <p className="muted auth-note">
              Jobs are securely scoped to your account. <Link to="/">Return to Dashboard</Link>
            </p>
          </div>

          <p className="auth-foot">
            <ShieldCheck size={13} /> Secured by HttpOnly cookies &middot; auto-rotating access tokens
          </p>
        </section>
      </div>
    </div>
  );
}