import LogoutButton from './LogoutButton';

function SettingIcon({ type }) {
  const paths = {
    account: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-3a8 8 0 0 1 16 0v3" /></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 6 9 7 9-7" /></>,
    swipe: <><path d="M4 8h16m-4-4 4 4-4 4M20 16H4m4-4-4 4 4 4" /></>,
  };
  return <span className={`setting-icon icon-${type}`}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[type]}</svg></span>;
}

export default function Settings({ settings, ready, saving, message, error, onChange, onRetry, authenticated, email, profileLoading, profileError, onProfileRetry, onHome, onLogout, version }) {
  return (
    <section className="settings-page" aria-labelledby="settings-heading">
      <div className="page-heading"><h1 id="settings-heading">Settings</h1><p>Make your next sweep your own.</p></div>
      <section className="settings-card account-card" aria-label="My email account">
        <SettingIcon type="account" />
        <div className="setting-copy"><h2>My email account</h2><p className="account-email">{!authenticated ? 'No account connected' : email || (profileLoading ? 'Loading account…' : 'Connected to Gmail')}</p>
          {profileError && <><p role="status">Your email address couldn’t be loaded.</p><button className="settings-text-button" onClick={onProfileRetry}>Try again</button></>}
          {!authenticated && <button className="settings-text-button" onClick={onHome}>Sign in with Google</button>}
          {email && <span className="account-connected">Connected</span>}
        </div>
      </section>

      <section aria-labelledby="preferences-heading">
        <h2 className="settings-section-title" id="preferences-heading">Cleaning preferences</h2>
        <div className="settings-card preferences-card">
          <div className="setting-field">
            <div className="setting-label-row"><SettingIcon type="mail" /><div className="setting-copy"><label htmlFor="session-size">Emails per session</label><p id="session-size-help">Scan up to 50 matching inbox emails.</p></div></div>
            <select id="session-size" aria-describedby="session-size-help session-size-note" value={50} disabled>
              <option value={50}>50 emails</option>
            </select>
            <p className="setting-hint" id="session-size-note">Fixed at 50 for now. Custom session sizes are coming later.</p>
          </div>
          <div className="setting-field">
            <div className="setting-label-row"><SettingIcon type="swipe" /><div className="setting-copy"><label htmlFor="swipe-preference">Review controls</label><p id="swipe-help">Choose how you review senders.</p></div></div>
            <select id="swipe-preference" aria-describedby="swipe-help" value={settings.swipePreference} disabled={!ready || saving} onChange={(event) => onChange({ swipePreference: event.target.value })}>
              <option value="swipe">Swipe only</option>
              <option value="buttons">Buttons only</option>
              <option value="both">Both</option>
            </select>
            <p className="setting-hint">{settings.swipePreference === 'buttons' ? 'Use the Unsubscribe and Keep buttons. Swipe gestures are off.' : settings.swipePreference === 'swipe' ? 'Swipe left to unsubscribe or right to keep. Action buttons are hidden.' : 'Swipe left to unsubscribe or right to keep, or use the buttons.'}</p>
          </div>
        </div>
        {error ? <div className="settings-feedback" role="alert"><p>{error}</p>{!ready && <button className="settings-text-button" onClick={onRetry}>Try again</button>}</div> : <p className="settings-feedback" role="status">{!ready ? 'Loading preferences…' : saving ? 'Saving…' : message}</p>}
      </section>

      <section aria-labelledby="account-help-heading">
        <h2 className="settings-section-title" id="account-help-heading">Account &amp; support</h2>
        <div className="settings-card settings-support">
          <details><summary>Privacy &amp; permissions</summary><div className="settings-details"><p>MailBroom reads matching inbox emails to group senders and show previews. Your choices, history, and preferences are saved on this device.</p><p>Unsubscribing may send a request or open a sender’s unsubscribe page. If that fails, MailBroom tries to filter future emails from that sender out of your inbox.</p><a href="https://myaccount.google.com/connections" target="_blank" rel="noreferrer">Manage Google account access ↗</a></div></details>
          <details><summary>Help &amp; about</summary><div className="settings-details"><p>Review one sender at a time. Choose Keep for emails you enjoy, or Unsubscribe for the rest. You have six seconds to undo a pending unsubscribe.</p><p>History shows your saved decisions. Unsubscribe requests can take time to take effect.</p><p>MailBroom {version}</p></div></details>
          {authenticated && <LogoutButton className="settings-signout" onLogout={onLogout} />}
        </div>
      </section>
    </section>
  );
}
