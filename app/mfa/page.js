import MfaChallenge from "./MfaChallenge";

export default function MfaPage() {
  return (
    <div className="center">
      <div className="auth stack">
        <div className="logo">Dhan<span>dha</span></div>
        <div className="panel stack">
          <div>
            <h1>Two-factor check</h1>
            <p className="muted small" style={{ margin: 0 }}>Enter the 6-digit code from your authenticator app.</p>
          </div>
          <MfaChallenge />
        </div>
      </div>
    </div>
  );
}
