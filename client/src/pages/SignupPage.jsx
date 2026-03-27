import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../utils/api";
import { PLACE_TYPE_OPTIONS } from "../utils/placeProfiles";

export default function SignupPage({ onSuccess }) {
  const [form, setForm] = useState({ email: "", password: "", placeType: "home" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const selectedPlace = useMemo(
    () => PLACE_TYPE_OPTIONS.find((item) => item.value === form.placeType) || PLACE_TYPE_OPTIONS[0],
    [form.placeType]
  );

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
        <span className="section-tag">AI-assisted setup</span>
        <h1>Select your place type once and get a fully configured smart energy system instantly.</h1>
        <p>
          Tesla-style automation creates the floor layout, room map, device mix, grid scale, and simulation profile for
          your place before you even open the dashboard.
        </p>

        <div className="auth-points">
          <article className="panel mini-panel">
            <strong>{selectedPlace.label} blueprint</strong>
            <span>{selectedPlace.description}</span>
          </article>
          <article className="panel mini-panel">
            <strong>{selectedPlace.gridSize}px smart grid</strong>
            <span>{selectedPlace.simulationMode}</span>
          </article>
          <article className="panel mini-panel">
            <strong>Ready instantly</strong>
            <span>Rooms, devices, alerts, and floors are prepared automatically after signup.</span>
          </article>
        </div>
      </section>

      <section className="auth-card panel">
        <div className="panel-head stacked">
          <div>
            <span className="section-tag">Smart signup</span>
            <h2>Create account</h2>
            <p>Pick your place type, create your login, and jump straight into the live dashboard.</p>
          </div>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <fieldset className="place-type-fieldset">
            <legend>Select your place type</legend>
            <div className="place-type-grid">
              {PLACE_TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`place-type-card ${form.placeType === option.value ? "active" : ""}`}
                  onClick={() => setForm((current) => ({ ...current, placeType: option.value }))}
                >
                  <strong>{option.label}</strong>
                  <span>{option.tagline}</span>
                  <small>{option.gridSize}px grid</small>
                </button>
              ))}
            </div>
          </fieldset>

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
            {submitting ? "Creating smart workspace..." : `Create ${selectedPlace.label} workspace`}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </section>
    </div>
  );
}
