import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../utils/api";

export default function SignupPage({ onSuccess }) {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
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
      const result = await api.signup(form);
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
        <span className="section-tag">Secure onboarding</span>
        <h1>Create your smart electricity account and start tracking usage room by room.</h1>
        <p>
          Store appliance controls, daily history, dashboard preferences, and live monitoring settings in one
          authenticated workspace.
        </p>

        <div className="auth-points">
          <article className="panel mini-panel">
            <strong>Multi-device control</strong>
            <span>Fan, AC, lights, TV, and refrigerator states are saved after login.</span>
          </article>
          <article className="panel mini-panel">
            <strong>Usage analytics</strong>
            <span>Track hourly, weekly, and monthly patterns with bill estimation.</span>
          </article>
          <article className="panel mini-panel">
            <strong>Responsive by design</strong>
            <span>Mobile bottom nav and desktop sidebar are both included.</span>
          </article>
        </div>
      </section>

      <section className="auth-card panel">
        <div className="panel-head stacked">
          <div>
            <span className="section-tag">Signup</span>
            <h2>Create account</h2>
            <p>Your password is hashed before being stored.</p>
          </div>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            <span>Name</span>
            <input type="text" name="name" value={form.name} onChange={updateField} placeholder="Full name" required />
          </label>

          <label>
            <span>Email</span>
            <input type="email" name="email" value={form.email} onChange={updateField} placeholder="you@example.com" required />
          </label>

          <label>
            <span>Password</span>
            <input type="password" name="password" value={form.password} onChange={updateField} placeholder="At least 6 characters" minLength="6" required />
          </label>

          {error ? <div className="form-alert error">{error}</div> : null}

          <button type="submit" className="primary-button" disabled={submitting}>
            {submitting ? "Creating account..." : "Signup"}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </section>
    </div>
  );
}
