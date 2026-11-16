import { useState } from 'react';
import { resolveProvider } from './emailProviders';

export default function Login({ onLogin, loading }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [imapHost, setImapHost] = useState('');
  const [imapPort, setImapPort] = useState('');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('');
  const [validationError, setValidationError] = useState('');

  // Derived state: automatically updates when email input changes
  const provider = resolveProvider(email);

  const handleSubmit = (e) => {
    e.preventDefault();
    setValidationError('');

    const cleanEmail = email.trim();
    const cleanPassword = password.trim().replace(/\s+/g, '');

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setValidationError('Please enter a valid email address.');
      return;
    }

    if (!cleanPassword || cleanPassword.length < 8) {
      setValidationError('Please enter your App Password.');
      return;
    }

    const payload = {
      user: cleanEmail,
      pass: cleanPassword,
    };

    // If recognized provider preset exists, populate standard IMAP and SMTP configurations
    if (provider) {
      payload.host = provider.imap.host;
      payload.port = provider.imap.port;
      payload.smtpHost = provider.smtp.host;
      payload.smtpPort = provider.smtp.port;
      payload.secure = provider.smtp.secure;
    }

    // Manual user overrides from Advanced Settings take precedence
    const customImapHost = imapHost.trim();
    const customImapPort = imapPort.trim();
    const customSmtpHost = smtpHost.trim();
    const customSmtpPort = smtpPort.trim();

    if (customImapHost) payload.host = customImapHost;
    if (customImapPort && !isNaN(customImapPort)) payload.port = Number(customImapPort);
    if (customSmtpHost) payload.smtpHost = customSmtpHost;
    if (customSmtpPort && !isNaN(customSmtpPort)) {
      payload.smtpPort = Number(customSmtpPort);
      // Auto-derive secure mode: port 465 uses direct SSL (secure: true); port 587/others use STARTTLS (secure: false)
      payload.secure = payload.smtpPort === 465;
    }

    // If domain is not recognized and custom hosts weren't provided, prompt user to fill advanced settings
    if (!provider && (!payload.host || !payload.smtpHost)) {
      setValidationError('Custom domain detected. Please enter your IMAP and SMTP server settings in Advanced Settings.');
      setShowAdvanced(true);
      return;
    }

    onLogin(payload);
  };

  return (
    <div style={{ maxWidth: 420, margin: '0 auto', textAlign: 'left' }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
              Email Address
            </label>
            {provider && (
              <span style={{ fontSize: 12, color: '#059669', fontWeight: 500 }}>
                {provider.name} detected
              </span>
            )}
          </div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            disabled={loading}
            required
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: 10,
              border: '1px solid #d1d5db',
              fontSize: 15,
              boxSizing: 'border-box'
            }}
          />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
              App Password
            </label>
            <button
              type="button"
              onClick={() => setShowGuide(!showGuide)}
              style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: 12, cursor: 'pointer', padding: 0 }}
            >
              {showGuide
                ? 'Hide instructions'
                : (provider ? `How to get a ${provider.guideName}?` : 'How to get an App Password?')}
            </button>
          </div>
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={provider ? `${provider.name} App Password` : 'App Password'}
              disabled={loading}
              required
              style={{
                width: '100%',
                padding: '10px 14px',
                paddingRight: 60,
                borderRadius: 10,
                border: '1px solid #d1d5db',
                fontSize: 15,
                boxSizing: 'border-box',
                fontFamily: showPassword ? 'inherit' : 'monospace'
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: '#6b7280',
                fontSize: 12,
                cursor: 'pointer'
              }}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        {showGuide && (
          <div style={{ background: '#f8fafc', padding: 14, borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13, lineHeight: 1.5, color: '#475569' }}>
            <strong style={{ display: 'block', color: '#1e293b', marginBottom: 6 }}>Creating an App Password:</strong>
            <ol style={{ margin: 0, paddingLeft: 18 }}>
              {provider ? (
                <>
                  <li>Make sure 2-Step Verification is turned on for your {provider.name} account.</li>
                  <li>
                    Open{' '}
                    <a href={provider.guideUrl} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: 600 }}>
                      {provider.guideName}
                    </a>.
                  </li>
                  <li>Name the app (e.g. <em>MailBroom</em>) and generate the password.</li>
                  <li>Copy the password and paste it above.</li>
                </>
              ) : (
                <>
                  <li>App Passwords are generated in your email provider's security settings.</li>
                  <li>Enter your email above to see provider-specific instructions, or generate one in your mail account.</li>
                </>
              )}
            </ol>
          </div>
        )}

        {validationError && (
          <p style={{ color: '#dc2626', fontSize: 13, margin: '2px 0 0' }}>{validationError}</p>
        )}

        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 12, textAlign: 'left', cursor: 'pointer', padding: '4px 0' }}
        >
          {showAdvanced ? '▾ Hide Advanced Settings' : '▸ Advanced Settings (Custom IMAP / SMTP)'}
        </button>

        {showAdvanced && (
          <div style={{ background: '#f9fafb', padding: 12, borderRadius: 10, border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 2 }}>
                <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 2 }}>IMAP Host</label>
                <input
                  type="text"
                  placeholder={provider ? provider.imap.host : 'imap.yourdomain.com'}
                  value={imapHost}
                  onChange={(e) => setImapHost(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 2 }}>IMAP Port</label>
                <input
                  type="text"
                  placeholder={provider ? String(provider.imap.port) : '993'}
                  value={imapPort}
                  onChange={(e) => setImapPort(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 2 }}>
                <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 2 }}>SMTP Host</label>
                <input
                  type="text"
                  placeholder={provider ? provider.smtp.host : 'smtp.yourdomain.com'}
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 2 }}>SMTP Port</label>
                <input
                  type="text"
                  placeholder={provider ? String(provider.smtp.port) : '587'}
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', fontSize: 13, borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }}
                />
              </div>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="login-button"
          style={{ width: '100%', marginTop: 8 }}
        >
          {loading ? 'Connecting & Verifying...' : 'Sign In & Sweep Clutter'}
        </button>
      </form>
    </div>
  );
}
