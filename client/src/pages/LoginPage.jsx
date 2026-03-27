import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../utils/api";

export default function LoginPage({ onSuccess }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function updateField(event) {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const result = await api.login(form);
      onSuccess(result);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-shell">
      <section className="auth-hero">
        <span className="section-tag">Smart electricity usage tracker</span>
        <h1>Monitor live power, control appliances, and reduce wasted energy.</h1>
        <p>
          A full-stack smart home dashboard with IoT-style telemetry, room-wise controls, bill estimation,
          alerts, and secure JWT authentication.
        </p>

        <div className="auth-points">
          <article className="panel mini-panel">
            <strong>Live monitoring</strong>
            <span>kWh, voltage, current, and peak-hour alerts.</span>
          </article>
          <article className="panel mini-panel">
            <strong>Top-view house map</strong>
            <span>Control room appliances and inspect demand instantly.</span>
          </article>
          <article className="panel mini-panel">
            <strong>Persistent backend</strong>
            <span>Device states and daily usage history stay saved to MongoDB.</span>
          </article>
        </div>
      </section>

      <section className="auth-card panel">
        <div className="panel-head stacked">
          <div>
            <span className="section-tag">Login</span>
            <h2>Welcome back</h2>
            <p>Sign in to continue to your energy dashboard.</p>
          </div>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            <span>Email</span>
            <input type="email" name="email" value={form.email} onChange={updateField} placeholder="you@example.com" required />
          </label>

          <label>
            <span>Password</span>
            <input type="password" name="password" value={form.password} onChange={updateField} placeholder="Enter password" required />
          </label>

          {error ? <div className="form-alert error">{error}</div> : null}

          <button type="submit" className="primary-button" disabled={submitting}>
            {submitting ? "Signing in..." : "Login"}
          </button>
        </form>

        <p className="auth-switch">
          Need an account? <Link to="/signup">Create one</Link>
        </p>
      </section>
    </div>
  );
}
