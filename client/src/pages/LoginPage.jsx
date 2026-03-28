import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../utils/api";

const RESET_INITIAL_STATE = {
  email: "",
  otp: "",
  newPassword: "",
};

export default function LoginPage({ onSuccess }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotStep, setForgotStep] = useState("request");
  const [forgotForm, setForgotForm] = useState(RESET_INITIAL_STATE);
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [forgotMessage, setForgotMessage] = useState("");

  function updateField(event) {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  function updateForgotField(event) {
    const { name, value } = event.target;

    setForgotForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function openForgotPassword() {
    const email = form.email || forgotForm.email;
    setForgotOpen(true);
    setForgotStep("request");
    setForgotError("");
    setForgotMessage("");
    setSuccessMessage("");
    setForgotForm((current) => ({
      ...RESET_INITIAL_STATE,
      email: email || current.email,
    }));
  }

  function closeForgotPassword() {
    setForgotOpen(false);
    setForgotStep("request");
    setForgotError("");
    setForgotMessage("");
    setForgotSubmitting(false);
    setForgotForm((current) => ({
      ...RESET_INITIAL_STATE,
      email: current.email,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccessMessage("");
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

  async function handleForgotRequest(event) {
    event.preventDefault();
    setForgotError("");
    setForgotMessage("");
    setSuccessMessage("");
    setForgotSubmitting(true);

    try {
      const result = await api.forgotPassword({ email: forgotForm.email });
      setForgotStep("verify");
      setForgotMessage(result.message || "OTP sent to your email address.");
    } catch (submitError) {
      setForgotError(submitError.message);
    } finally {
      setForgotSubmitting(false);
    }
  }

  async function handleResetPassword(event) {
    event.preventDefault();
    setForgotError("");
    setForgotMessage("");
    setSuccessMessage("");
    setForgotSubmitting(true);

    try {
      const result = await api.resetPassword({
        email: forgotForm.email,
        otp: forgotForm.otp,
        newPassword: forgotForm.newPassword,
      });

      setForm((current) => ({
        ...current,
        email: forgotForm.email,
        password: "",
      }));
      setForgotOpen(false);
      setForgotStep("request");
      setForgotForm((current) => ({
        ...RESET_INITIAL_STATE,
        email: current.email,
      }));
      setSuccessMessage(result.message || "Password updated successfully.");
    } catch (submitError) {
      setForgotError(submitError.message);
    } finally {
      setForgotSubmitting(false);
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
          {successMessage ? <div className="form-alert success">{successMessage}</div> : null}

          <button type="submit" className="primary-button" disabled={submitting}>
            {submitting ? "Signing in..." : "Login"}
          </button>
        </form>

        <div className="auth-form-footer">
          <button type="button" className="inline-link-button" onClick={openForgotPassword}>
            Forgot password?
          </button>
          <p className="auth-switch">
            Need an account? <Link to="/signup">Create one</Link>
          </p>
        </div>

        {forgotOpen ? (
          <section className="auth-reset-panel mini-panel">
            <div className="panel-head stacked">
              <div>
                <span className="section-tag">Reset password</span>
                <h3>{forgotStep === "request" ? "Send OTP to your email" : "Verify OTP and set a new password"}</h3>
                <p>
                  {forgotStep === "request"
                    ? "Enter your account email and we will send a 6-digit OTP to your mailbox."
                    : "Enter the OTP from your email and choose a new password to finish the reset."}
                </p>
              </div>
            </div>

            <form className="auth-form" onSubmit={forgotStep === "request" ? handleForgotRequest : handleResetPassword}>
              <label>
                <span>Email</span>
                <input
                  type="email"
                  name="email"
                  value={forgotForm.email}
                  onChange={updateForgotField}
                  placeholder="you@example.com"
                  required
                />
              </label>

              {forgotStep === "verify" ? (
                <>
                  <label>
                    <span>OTP code</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      name="otp"
                      value={forgotForm.otp}
                      onChange={updateForgotField}
                      placeholder="Enter 6-digit OTP"
                      maxLength={6}
                      required
                    />
                  </label>

                  <label>
                    <span>New password</span>
                    <input
                      type="password"
                      name="newPassword"
                      value={forgotForm.newPassword}
                      onChange={updateForgotField}
                      placeholder="Minimum 6 characters"
                      minLength={6}
                      required
                    />
                  </label>
                </>
              ) : null}

              {forgotError ? <div className="form-alert error">{forgotError}</div> : null}
              {forgotMessage ? <div className="form-alert info">{forgotMessage}</div> : null}

              <div className="auth-inline-actions">
                {forgotStep === "verify" ? (
                  <button
                    type="button"
                    className="ghost-button wide-button"
                    onClick={() => {
                      setForgotStep("request");
                      setForgotError("");
                      setForgotMessage("");
                    }}
                  >
                    Send a new OTP
                  </button>
                ) : null}

                <button type="submit" className="primary-button wide-button" disabled={forgotSubmitting}>
                  {forgotSubmitting
                    ? forgotStep === "request"
                      ? "Sending OTP..."
                      : "Resetting password..."
                    : forgotStep === "request"
                      ? "Send OTP"
                      : "Reset password"}
                </button>

                <button type="button" className="ghost-button wide-button" onClick={closeForgotPassword}>
                  Close
                </button>
              </div>
            </form>
          </section>
        ) : null}
      </section>
    </div>
  );
}
