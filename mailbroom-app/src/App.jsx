import { useEffect, useRef, useState } from 'react';
import './App.css';
import { getSenderIdentity } from './senderIdentity';
import { gmailApi } from './gmail.js';
import RefreshLogo from '@components/RefreshLogo';
import LogoutButton from '@components/LogoutButton';
import mailbroomLogo from './assets/mailbroomlogo.png';

const UNDO_MS = 6000; // time for the user to undo an unsubscribe action
const THRESHOLD = 110; // px of horizontal drag

function SenderAvatar({ identity }) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="sender-avatar" aria-hidden="true">
      {identity.iconUrl && !failed ? (
        <img
          src={identity.iconUrl}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : identity.initials}
    </div>
  );
}

function SenderCard({ senders, onDecision }) {
  const [i, setI] = useState(0);
  const sender = senders[i];

  const drag = useRef({ active: false, startX: 0, dx: 0 });
  const card = useRef(null);

  const decide = (action) => {
    onDecision?.(sender, action);
    setI(n => n + 1);
  };

  // slide the card off screen in the chosen direction, then advance
  const flyOut = (action) => {
    const el = card.current;
    if (!el) return decide(action);
    const x = action === 'unsubscribe' ? -600 : 600;
    el.style.transition = 'transform .3s ease, opacity .3s ease';
    el.style.transform = `translate(${x}px, 40px) rotate(${x / 18}deg)`;
    el.style.opacity = 0;
    setTimeout(() => decide(action), 280);
  };

  const onPointerDown = (e) => {
    drag.current = { active: true, startX: e.clientX, dx: 0 };
    card.current.setPointerCapture(e.pointerId);   
    card.current.style.transition = 'none';
  };

  const onPointerMove = (e) => {
    if (!drag.current.active) return;
    const dx = (drag.current.dx = e.clientX - drag.current.startX);
    card.current.style.transform = `translate(${dx}px, 0) rotate(${dx / 18}deg)`;

    // fade in whichever label matches the direction of travel
    const strength = Math.min(Math.abs(dx) / THRESHOLD, 1);
    card.current.querySelector('.verdict-no').style.opacity = dx < 0 ? strength : 0;
    card.current.querySelector('.verdict-yes').style.opacity = dx > 0 ? strength : 0;
  };

  const onPointerUp = () => {
    const { active, dx } = drag.current;
    if (!active) return;
    drag.current.active = false;

    if (Math.abs(dx) > THRESHOLD) return flyOut(dx < 0 ? 'unsubscribe' : 'keep');

    // if you didn't drag far enough then the card snaps back into place
    card.current.style.transition = 'transform .3s ease';
    card.current.style.transform = 'translate(0,0) rotate(0)';
    card.current.querySelector('.verdict-no').style.opacity = 0;
    card.current.querySelector('.verdict-yes').style.opacity = 0;
  };

  if (!sender) {
    return <p className="card-done">All done. Reviewed {i} senders.</p>;
  }

  const identity = getSenderIdentity(sender.from);

  return (
    <>
      <div className="card-progress">{i} of {senders.length} reviewed</div>

      {/* Reset swipe styles when the sender changes */}
      <div
        key={sender.from}
        ref={card}
        className="card"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <div className="verdict verdict-no">UNSUBSCRIBE</div>
        <div className="verdict verdict-yes">KEEP</div>

        <div className="sender-heading">
          <SenderAvatar key={sender.from} identity={identity} />
          <div className="sender-details">
            <div className="card-from">{identity.name}</div>
            {identity.name !== identity.email && (
              <div className="sender-email">{identity.email}</div>
            )}
          </div>
        </div>
        <div className="card-stats">
          {sender.count} message{sender.count === 1 ? '' : 's'} · {sender.opened} opened
        </div>
        {sender.opened === 0 && <div className="card-never">never opened</div>}
        {sender.latest && (
          <div className="email-preview">
            <div className="preview-label">Latest email</div>
            <div className="preview-date">
              {new Date(sender.latest.timestamp).toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </div>
            <div className="preview-subject">{sender.latest.subject}</div>
            <p className="preview-snippet">{sender.latest.snippet}</p>
          </div>
        )}
      </div>

      <div className="card-buttons">
        <button className="btn-unsub" onClick={() => flyOut('unsubscribe')}>Unsubscribe</button>
        <button className="btn-keep" onClick={() => flyOut('keep')}>Keep</button>
      </div>
    </>
  );
}

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
      const result = await gmailApi.unsubscribe(s);
      setStatus(result.message || `Unsubscribed from ${s.from}`);
    } catch (err) {
      console.error(err);
      setStatus('Unsubscribe failed. Check the console.');
      setFailed((f) => [...f, s.from]);
    }
  };

  const scheduleUnsubscribe = async (s) => {
    await gmailApi.markUnsubscribed(s);
    setPending((p) => [...p, s]);
    timers.current[s.from] = setTimeout(() => {
      delete timers.current[s.from];
      setPending((p) => p.filter((x) => x.from !== s.from));
      handleUnsubscribe(s); // the real request happens here
    }, UNDO_MS);
  };

  const undoUnsubscribe = async (s) => {
    clearTimeout(timers.current[s.from]);
    delete timers.current[s.from];
    setPending((p) => p.filter((x) => x.from !== s.from));

    await gmailApi.cancelUnsubscribe(s);
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
      <button disabled={loading} onClick={handleLogin} style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer' }}>
        {loading ? 'Signing in...' : 'Login with Google'}
      </button>

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

          <div className="undo-container">
            {pending.map((s) => (
              <div key={s.from} className="undo-bar">
                Unsubscribing from {s.from}...{' '}
                <button onClick={() => undoUnsubscribe(s)}>Undo</button>
              </div>
            ))}
          </div>

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
