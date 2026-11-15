import { useEffect, useRef, useState } from 'react';
import './App.css';
import { gmailApi } from './gmail.js';
import RefreshLogo from '@components/RefreshLogo';
import LogoutButton from '@components/LogoutButton';
import mailbroomLogo from './assets/mailbroomlogo.png';
import Login from './Login';
import UndoPopup from './UndoPopup';
import SenderCard from './SenderCard';
import { moveSenderToSpam } from './spamFilter';
import BottomNav from './components/BottomNav';
import LoadingBroom from './components/LoadingBroom';
import Welcome from './components/Welcome';
import History from './components/History';
import { reviewHistory } from './history';
import Settings from './components/Settings';
import { DEFAULT_SETTINGS, settingsStore } from './settings';
import packageInfo from '../package.json';

const UNDO_MS = 6000; // time for the user to undo an unsubscribe action




export default function App() {
  const [hasStarted, setHasStarted] = useState(false);
  const [activePage, setActivePage] = useState('Home');
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [settingsReady, setSettingsReady] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [settingsRetry, setSettingsRetry] = useState(0);
  const settingsRef = useRef(DEFAULT_SETTINGS);
  const settingsSaveInFlight = useRef(false);
  const [accountEmail, setAccountEmail] = useState('');
  const [profileError, setProfileError] = useState('');
  const [profileRetry, setProfileRetry] = useState(0);
  const [historyEntries, setHistoryEntries] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const [historyRetry, setHistoryRetry] = useState(0);
  const sessionEpoch = useRef(0);
  const historyRevision = useRef(0);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [failed, setFailed] = useState([]);
  const [senders, setSenders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [loadError, setLoadError] = useState('');
  const loadInFlight = useRef(false);
  const loginInFlight = useRef(false);
  const timers = useRef({});
  const [pending, setPending] = useState([]);

  useEffect(() => {
    const controller = new AbortController();
    settingsStore.read().then((saved) => {
      if (controller.signal.aborted) return;
      settingsRef.current = saved;
      setSettings(saved);
      setSettingsReady(true);
    }).catch(() => {
      if (!controller.signal.aborted) setSettingsError('Your preferences could not be loaded. Please try again.');
    });
    return () => controller.abort();
  }, [settingsRetry]);

  useEffect(() => {
    if (!isAuthenticated || activePage !== 'Settings' || accountEmail) return;
    const controller = new AbortController();
    gmailApi.getProfile({ signal: controller.signal }).then((profile) => {
      if (!profile?.emailAddress) throw new Error('Email address missing');
      if (!controller.signal.aborted) {
        setAccountEmail(profile.emailAddress);
        setProfileError('');
      }
    }).catch(() => {
      if (!controller.signal.aborted) setProfileError('Account details unavailable');
    });
    return () => controller.abort();
  }, [isAuthenticated, activePage, accountEmail, profileRetry]);

  const updateSettings = async (changes) => {
    if (settingsSaveInFlight.current) return;
    settingsSaveInFlight.current = true;
    setSettingsSaving(true);
    setSettingsError('');
    setSettingsMessage('');
    try {
      const saved = await settingsStore.save({ ...settingsRef.current, ...changes });
      settingsRef.current = saved;
      setSettings(saved);
      setSettingsMessage('Preferences saved.');
    } catch {
      setSettingsError('Your change could not be saved. Please try again.');
    } finally {
      settingsSaveInFlight.current = false;
      setSettingsSaving(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    const controller = new AbortController();
    const revision = historyRevision.current;
    reviewHistory.read().then((entries) => {
      if (!controller.signal.aborted && revision === historyRevision.current) setHistoryEntries(entries);
    }).catch(() => {
      if (!controller.signal.aborted) setHistoryError('Your saved history could not be loaded. Please try again.');
    }).finally(() => {
      if (!controller.signal.aborted) setHistoryLoading(false);
    });
    return () => controller.abort();
  }, [isAuthenticated, historyRetry]);

  const recordReview = async (sender, outcome, epoch) => {
    try {
      const entries = await reviewHistory.save(sender, outcome);
      if (epoch === sessionEpoch.current) {
        historyRevision.current += 1;
        setHistoryEntries(entries);
      }
    } catch {
      if (epoch === sessionEpoch.current) setStatus('Your action completed, but it could not be saved to History.');
    }
  };

  // Wait for the welcome screen before checking the saved session.
  useEffect(() => {
    if (!hasStarted) return;
    let isMounted = true;
    const checkAutoLogin = async () => {
      setLoading(true);
      try {
        const token = await gmailApi.authenticate(false);
        if (token && isMounted) {
          setIsAuthenticated(true);
          await loadSenders();
        }
      } catch (err) {
        console.warn('Auto-login check failed:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    checkAutoLogin();
    return () => {
      isMounted = false;
      gmailApi.cancelActiveRequests();
    };
  }, [hasStarted]);

  const handleLogin = async () => {
    if (loginInFlight.current) return;
    loginInFlight.current = true;
    setLoading(true);
    try {
      await gmailApi.authenticate();
      setIsAuthenticated(true);
      await loadSenders();
    } catch (error) {
      console.error('Login failed:', error);
      setStatus("The sign in didn't complete. If this is your first time trying to use MailBroom, your Gmail address may not be approved for testing (yet)... Send it to the team and try again.");
    } finally {
      loginInFlight.current = false;
      setLoading(false);
    }
  };

  const loadSenders = async () => {
    if (loadInFlight.current) return;
    const epoch = sessionEpoch.current;
    loadInFlight.current = true;
    setLoading(true);
    setStatus('');
    setLoadError('');
    setFailed([]);

    try {
      if (epoch !== sessionEpoch.current) return;
      const data = await gmailApi.loadSenders();

      if (gmailApi.isActive && data) {
        setSenders(data);
      }
    } catch (err) {
      if (gmailApi.isCancelled(err)) {
        return;
      }
      console.error('Failed to load emails:', err);
      setLoadError(err.message || 'Failed to load emails. Please try again.');

      if (err.message?.includes('session expired') || err.message?.includes('401')) {
        setIsAuthenticated(false); // Reset back to login
        setStatus('Session expired. Please log in again.');
      }
    } finally {
      if (gmailApi.isActive) {
        loadInFlight.current = false;
        setLoading(false);
      }
    }
  };

  const handleLogout = async () => {
    try {
      sessionEpoch.current += 1;
      setActivePage('Home');
      setHistoryEntries([]);
      setHistoryLoading(true);
      setHistoryError('');
      setAccountEmail('');
      setProfileError('');
      loadInFlight.current = false;
      loginInFlight.current = false;

      // Clear any pending unsubscribe timers
      Object.values(timers.current).forEach((t) => clearTimeout(t));
      timers.current = {};
      setPending([]);

      // Reset UI state
      setLoading(false);
      setLoadError('');
      setSenders([]);
      setFailed([]);
      setIsAuthenticated(false);
      setStatus('Signed out.');

      // Logout of gmailApi, clears tokens and processing requests
      await gmailApi.logout();
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const handleUnsubscribe = async (s) => {
    const epoch = sessionEpoch.current;
    const token = gmailApi.getToken();
    let outcome = 'requested';
    try {
      const result = await gmailApi.unsubscribe(s);
      if (!result.ok) throw new Error(result.message || 'Unsubscribe failed');
      if (epoch !== sessionEpoch.current) return;
      setStatus(result.message || `Unsubscribe requested for ${s.from}`);
    } catch (err) {
      console.error(err);
      const cleanEmail = s.from.match(/<([^>]+)>/)?.[1] || s.from;
      if (epoch !== sessionEpoch.current) return;
      const filtered = await moveSenderToSpam(token, cleanEmail);
      if (epoch !== sessionEpoch.current) return;
      if (!filtered) {
        setFailed((items) => [...items, s.from]);
        setStatus(`Could not unsubscribe or filter ${s.from}. Please try again.`);
        return;
      }
      outcome = 'filtered';
      setStatus(`Unsubscribe failed. Future emails from ${s.from} will skip your inbox.`);
    }
    if (epoch === sessionEpoch.current) await recordReview(s, outcome, epoch);
  };
  
    const scheduleUnsubscribe = async (s) => {

      setPending((p) => [...p, s]);
    timers.current[s.from] = setTimeout(() => {
      delete timers.current[s.from];
      setPending((p) => p.filter((x) => x.from !== s.from));
      handleUnsubscribe(s);
    }, UNDO_MS);
  };

  const undoUnsubscribe = async (s) => {
    clearTimeout(timers.current[s.from]);
    delete timers.current[s.from];
    setPending((p) => p.filter((x) => x.from !== s.from));

    setStatus(`Cancelled unsubscribe for ${s.from}`);
  };

  const handleDecision = async (sender, action) => {
    if (action === 'unsubscribe') {
      scheduleUnsubscribe(sender);
    } else {
      const epoch = sessionEpoch.current;
      try {
        await gmailApi.keepSender(sender);
        if (epoch !== sessionEpoch.current) return;
        setStatus(`Kept ${sender.from}`);
        await recordReview(sender, 'kept', epoch);
      } catch {
        setStatus(`Could not save ${sender.from} as kept. Please try again.`);
      }
    }
  };

  if (!hasStarted) {
    return <Welcome onStart={() => setHasStarted(true)} />;
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        {!isAuthenticated && !loading && (
        <h1 className="app-brand">
          <img className="app-logo" src={mailbroomLogo} alt="MailBroom" width="2159" height="728" />
        </h1>
        )}
        {isAuthenticated && activePage !== 'Settings' ? (
          <div className="app-header-actions">
            {activePage === 'Home' ? <RefreshLogo onRefresh={() => loadSenders()} /> : <span />}
            <LogoutButton onLogout={handleLogout} />
          </div>
        ) : null}
      </header>
      <main className="home-page" aria-label={activePage}>
      {activePage === 'Settings' && <Settings
        settings={settings} ready={settingsReady} saving={settingsSaving} message={settingsMessage} error={settingsError}
        onChange={updateSettings} onRetry={() => { setSettingsError(''); setSettingsRetry((value) => value + 1); }}
        authenticated={isAuthenticated} email={accountEmail} profileLoading={isAuthenticated && !accountEmail && !profileError}
        profileError={profileError} onProfileRetry={() => { setProfileError(''); setProfileRetry((value) => value + 1); }}
        onHome={() => setActivePage('Home')} onLogout={handleLogout} version={packageInfo.version}
      />}
      {activePage === 'History' && <History entries={historyEntries} loading={historyLoading} error={historyError} onRetry={() => {
        setHistoryLoading(true);
        setHistoryError('');
        setHistoryRetry((value) => value + 1);
      }} onHome={() => setActivePage('Home')} authenticated={isAuthenticated} />}
      <div id="home" hidden={activePage !== 'Home'}>
      {!isAuthenticated ? (
        <section className="login-panel" aria-label="Connect your inbox">
          <h2>A little less inbox clutter.</h2>
          <p className="login-intro">Review your senders, keep what you love, and sweep away the rest.</p>
          <Login onLogin={handleLogin} loading={loading} />
          {loading && <LoadingBroom message="Connecting to Google..." />}
          {status && (
            <p role="alert" style={{ maxWidth: 420, margin: '16px auto', color: '#b45309' }}>
              {status}
            </p>
          )}
          <p style={{ maxWidth: 420, margin: '16px auto', color: '#6b7280', fontSize: 14 }}>
            Google will warn that MailBroom is not verified. This is an expected warning...
            Please click "Advanced", then "Go to MailBroom (unsafe)" to continue.
          </p>
        </section>
      ) : (
        <div className="review-session">
          {loading && <LoadingBroom />}
          {loadError && !loading && (
            <div role="alert">
              <p>{loadError}</p>
              <button onClick={() => loadSenders()}>Retry loading emails</button>
              <button onClick={handleLogin}>Sign in again</button>
            </div>
          )}
          {status && <p className="session-status" role="status">{status}</p>}
          
          
          {!loading && senders.length > 0 && (
            <SenderCard senders={senders} onDecision={handleDecision} swipePreference={settings.swipePreference} />
          )}
          {failed.length > 0 && (
            <div className="card-failed">
              <p>Couldn't unsubscribe from {failed.length}:</p>
              <ul>{failed.map((f) => <li key={f}>{f}</li>)}</ul>
            </div>
          )}

          {!loading && !loadError && senders.length === 0 && (
            <p>No senders to review in this scan of up to 50 matching inbox emails.</p>
          )}
        </div>
      )}
      </div>
      </main>
      {isAuthenticated && <UndoPopup pending={pending} onUndo={undoUnsubscribe} />}
      <BottomNav activePage={activePage} onNavigate={setActivePage} />
    </div>
  );
}
