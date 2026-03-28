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
        <h1>Monitor live power, design every floor your way, and keep the full energy system under control.</h1>
        <p>
          Home, school, office, and industrial profiles start with the right floor scale and smart defaults, but the
          final room map and device placement stay in your hands.
        </p>

        <div className="auth-points">
          <article className="panel mini-panel">
            <strong>Manual smart layout</strong>
            <span>Start from a clean blueprint, then draw rooms and place only the devices you actually want.</span>
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
