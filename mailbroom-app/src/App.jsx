import { useEffect, useRef, useState } from 'react';
import './App.css';
import { getSenderIdentity } from './senderIdentity';
import { gmailApi } from './gmail.js';
import RefreshLogo from '@components/RefreshLogo';
import LogoutButton from '@components/LogoutButton';
import mailbroomLogo from './assets/mailbroomlogo.png';
import Login from './Login';
import UndoPopup from './UndoPopup';
import SenderCard from './SenderCard';
import { moveSenderToSpam } from './spamFilter';

const UNDO_MS = 6000; // time for the user to undo an unsubscribe action
const THRESHOLD = 110; // px of horizontal drag




export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [failed, setFailed] = useState([]);
  const [senders, setSenders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [loadError, setLoadError] = useState('');
  const [loadProgress, setLoadProgress] = useState('');
  const loadInFlight = useRef(false);
  const loginInFlight = useRef(false);
  const timers = useRef({});
  const [pending, setPending] = useState([]);

  // Check for auto-login on load
  useEffect(() => {
    let isMounted = true;
    const checkAutoLogin = async () => {
      try {
        const token = await gmailApi.authenticate(false);
        if (token && isMounted) {
          setIsAuthenticated(true);
          await loadSenders();
        }
      } catch (err) {
        console.warn('Auto-login check failed:', err);
      }
    };
    checkAutoLogin();
    return () => {
      isMounted = false;
      gmailApi.cancelActiveRequests();
    };
  }, []);

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
    loadInFlight.current = true;
    setLoading(true);
    setStatus('');
    setLoadError('');
    setFailed([]);
    setLoadProgress('Loading your emails...');

    try {
      const onRetry = (seconds) => {
        if (gmailApi.isActive) {
          setLoadProgress(`Gmail is busy. Retrying in ${seconds}s...`);
        }
      };

      const data = await gmailApi.loadSenders({
        onRetry,
        onProgress: (done, total) => {
          if (gmailApi.isActive) {
            setLoadProgress(`Loading emails: ${done} of ${total}...`);
          }
        },
      });

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
        setLoadProgress('');
      }
    }
  };

  const handleLogout = async () => {
    try {
      loadInFlight.current = false;
      loginInFlight.current = false;

      // Clear any pending unsubscribe timers
      Object.values(timers.current).forEach((t) => clearTimeout(t));
      timers.current = {};
      setPending([]);

      // Reset UI state
      setLoading(false);
      setLoadProgress('');
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
    try {
      const result = await gmailApi.unsubscribe(s); // comment to test the spam filter
      //const result = { ok: false, message: "Fake failure for testing" };
      // ^==uncomment to test the spam filter ==^
      
      if (result.ok) {
        setStatus(result.message || `Unsubscribed from ${s.from}`);
      } else {
        const cleanEmail = s.from.match(/<([^>]+)>/)?.[1] || s.from;
        await moveSenderToSpam(gmailApi.getToken(), cleanEmail);
        setStatus(`Unsubscribe failed. ${s.from} has been moved to spam.`);
      }
    } catch (err) {
      console.error(err);
      const cleanEmail = s.from.match(/<([^>]+)>/)?.[1] || s.from;
      await moveSenderToSpam(gmailApi.getToken(), cleanEmail);
      setStatus(`Unsubscribe failed. ${s.from} has been moved to spam.`);
    }
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
      await gmailApi.keepSender(sender);
      setStatus(`Kept ${sender.from}`);
    }
  };

    return (
    <div style={{ padding: 20, textAlign: 'center', fontFamily: 'sans-serif', overflowX: 'hidden' }}>
      <header className="app-header">
        <h1 className="app-brand">
          <img className="app-logo" src={mailbroomLogo} alt="MailBroom" width="2159" height="728" />
        </h1>
        {isAuthenticated ? (
          <div className="app-header-actions">
            <RefreshLogo size={50} onRefresh={() => loadSenders()} />
            <LogoutButton onLogout={handleLogout} />
          </div>
        ) : null}
      </header>
      
      {!isAuthenticated ? (
        <>
          <Login onLogin={handleLogin} loading={loading} />
          {status && (
            <p role="alert" style={{ maxWidth: 420, margin: '16px auto', color: '#b45309' }}>
              {status}
            </p>
          )}
          <p style={{ maxWidth: 420, margin: '16px auto', color: '#6b7280', fontSize: 14 }}>
            Google will warn that MailBroom is not verified. This is an expected warning...
            Please click "Advanced", then "Go to MailBroom (unsafe)" to continue.
          </p>
        </>
      ) : (
        <div>
          {loading && <p role="status">{loadProgress || 'Loading your emails...'}</p>}
          {loadError && !loading && (
            <div role="alert">
              <p>{loadError}</p>
              <button onClick={() => loadSenders()}>Retry loading emails</button>
              <button onClick={handleLogin}>Sign in again</button>
            </div>
          )}
          {status && <p>{status}</p>}
          
          <UndoPopup pending={pending} onUndo={undoUnsubscribe} />
          
          {!loading && senders.length > 0 && (
            <SenderCard senders={senders} onDecision={handleDecision} />
          )}
          {failed.length > 0 && (
            <div className="card-failed">
              <p>Couldn't unsubscribe from {failed.length}:</p>
              <ul>{failed.map((f) => <li key={f}>{f}</li>)}</ul>
            </div>
          )}

          {!loading && !loadError && senders.length === 0 && (
            <p>No senders with an unsubscribe option in your 50 most recent emails.</p>
          )}
        </div>
      )}
    </div>
  );
}