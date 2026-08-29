import React, { useState, useEffect } from 'react';
import { X, Send, FileText, KeyRound, Code, Layers, ShieldCheck, RefreshCw } from 'lucide-react';
import { useCreateJob } from '../hooks/useQueries';
import { useUI } from '../context/UIContext';
import { getErrorMessage } from '../api/client';

const JOB_PRESETS = {
  welcome: {
    type: 'email',
    priority: 5,
    maxAttempts: 3,
    payload: JSON.stringify(
      { to: 'user@example.com', subject: 'Welcome to JobOrchestrator!', body: 'Thank you for joining our platform. Your account is active.' },
      null,
      2
    ),
  },
  invoice: {
    type: 'email',
    priority: 8,
    maxAttempts: 5,
    payload: JSON.stringify(
      { to: 'user@example.com', subject: 'Invoice #1024 Statement', body: 'Your invoice for $49.00 has been processed successfully.' },
      null,
      2
    ),
  },
  reset: {
    type: 'email',
    priority: 3,
    maxAttempts: 3,
    payload: JSON.stringify(
      { to: 'user@example.com', subject: 'Password Reset Verification', body: 'Use token #98214 to reset your password.' },
      null,
      2
    ),
  },
  custom: {
    type: 'email',
    priority: 0,
    maxAttempts: 3,
    payload: JSON.stringify({ to: 'your.email@gmail.com', subject: 'Test Email Notification', body: 'Hello! This is a real test email from JobOrchestrator.' }, null, 2),
  },
};

const PRESET_LIST = [
  { key: 'welcome', label: 'Welcome', icon: <Send size={14} /> },
  { key: 'invoice', label: 'Invoice', icon: <FileText size={14} /> },
  { key: 'reset', label: 'Password Reset', icon: <KeyRound size={14} /> },
  { key: 'custom', label: 'Custom', icon: <Code size={14} /> },
];

export default function CreateJobModal() {
  const { isCreateJobOpen, createPreset, closeCreateJob, showToast } = useUI();
  const createJob = useCreateJob();

  const [type, setType] = useState('email');
  const [priority, setPriority] = useState(5);
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [payloadStr, setPayloadStr] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [useIdempotency, setUseIdempotency] = useState(true);
  const [jsonError, setJsonError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState('welcome');

  useEffect(() => {
    if (isCreateJobOpen) {
      const preset = createPreset && JOB_PRESETS[createPreset] ? createPreset : 'welcome';
      setSelectedPreset(preset);
      applyPreset(preset);
      setIdempotencyKey(generateKey());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCreateJobOpen, createPreset]);

  const applyPreset = (key) => {
    const preset = JOB_PRESETS[key] || JOB_PRESETS.welcome;
    setSelectedPreset(key);
    setType(preset.type);
    setPriority(preset.priority);
    setMaxAttempts(preset.maxAttempts);
    setPayloadStr(preset.payload);
    setJsonError(null);
  };

  const generateKey = () => `idempotent_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setJsonError(null);

    let parsedPayload = {};
    try {
      parsedPayload = payloadStr.trim() ? JSON.parse(payloadStr) : {};
    } catch {
      setJsonError('Invalid JSON format in the payload field.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createJob.mutateAsync({
        type,
        priority: Number(priority),
        maxAttempts: Number(maxAttempts),
        payload: parsedPayload,
        idempotencyKey: useIdempotency ? idempotencyKey : undefined,
      });
      showToast(`Job ${res.job?.jobId || 'created'} accepted & enqueued!`);
      closeCreateJob();
    } catch (err) {
      showToast(getErrorMessage(err, 'Failed to dispatch job'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isCreateJobOpen) return null;

  return (
    <div className="overlay" onClick={closeCreateJob}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h3>Dispatch New Job</h3>
            <p>Configure a payload and enqueue it to the BullMQ cluster</p>
          </div>
          <button className="icon-btn" onClick={closeCreateJob} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label className="form-label">
              <Layers size={13} className="text-icon" /> Quick Presets
            </label>
            <div className="preset-grid">
              {PRESET_LIST.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  className={`preset-btn ${selectedPreset === preset.key ? 'active' : ''}`}
                  onClick={() => applyPreset(preset.key)}
                >
                  {preset.icon} {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Job Type</label>
            <input
              type="text"
              className="form-input"
              value={type}
              onChange={(e) => setType(e.target.value)}
              required
              placeholder="email"
            />
            <p className="field-hint">Only &quot;email&quot; is currently registered by the queue processors.</p>
          </div>

          <div className="form-row form-group">
            <div>
              <label className="form-label">Priority</label>
              <input
                type="range"
                min="0"
                max="10"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="range-input"
              />
              <div className="range-labels">
                <span>0 · Normal</span>
                <span className="accent">{priority}</span>
                <span>10 · Urgent</span>
              </div>
            </div>
            <div>
              <label className="form-label">Max Attempts</label>
              <input
                type="number"
                min="1"
                max="10"
                className="form-input"
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group idempotency-box">
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={useIdempotency}
                onChange={(e) => setUseIdempotency(e.target.checked)}
              />
              Enable idempotency protection
            </label>
            {useIdempotency && (
              <div className="idempotency-row">
                <input type="text" className="form-input mono compact-input" value={idempotencyKey} readOnly />
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIdempotencyKey(generateKey())} title="Regenerate">
                  <RefreshCw size={14} /> Regen
                </button>
              </div>
            )}
            <p className="field-hint idempotency-hint">
              <ShieldCheck size={12} className="text-icon" /> Sends an <span className="mono">idempotency-key</span> header so repeated submits are deduplicated.
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">JSON Payload</label>
            <textarea
              className="form-textarea mono json-textarea"
              rows={5}
              value={payloadStr}
              onChange={(e) => setPayloadStr(e.target.value)}
              placeholder="{}"
            />
            {jsonError && <p className="field-error">{jsonError}</p>}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={closeCreateJob}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Enqueuing...' : 'Enqueue Job'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
