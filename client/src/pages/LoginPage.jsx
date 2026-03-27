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
        <span className="section-tag">Smart electricity management</span>
        <h1>Monitor live power, control every floor, and let AI shape the energy system around your place type.</h1>
        <p>
          Home, school, office, and industrial profiles each get a tailored multi-floor layout, smart device mix,
          peak-hour simulation, and live alerts from one secure dashboard.
        </p>

        <div className="auth-points">
          <article className="panel mini-panel">
            <strong>AI-assisted layout</strong>
            <span>Auto-generated rooms, floors, and device suggestions appear as soon as you sign up.</span>
          </article>
          <article className="panel mini-panel">
            <strong>Realtime simulation</strong>
            <span>kWh, voltage, current, spikes, and peak-hour behavior refresh continuously.</span>
          </article>
          <article className="panel mini-panel">
            <strong>Persistent backend</strong>
            <span>Layouts, device states, and daily usage stay synced to MongoDB Atlas.</span>
          </article>
        </div>
      </section>

      <section className="auth-card panel">
        <div className="panel-head stacked">
          <div>
            <span className="section-tag">Login</span>
            <h2>Welcome back</h2>
            <p>Sign in to continue to your intelligent energy dashboard.</p>
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
