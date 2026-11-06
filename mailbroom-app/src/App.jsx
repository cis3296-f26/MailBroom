
import { useRef, useState } from 'react';
import './App.css';
import { getSenderIdentity } from './senderIdentity';
import { gmailApi } from './gmail.js';
import {
  isAlreadyUnsubscribed,
  saveUnsubscribedEmail,
  isAlreadyKept,
  saveKeptEmail,
  removeUnsubscribedEmail,
} from './storage';
import RefreshLogo from '@components/RefreshLogo';

function parseUnsubscribe(listUnsub = '', listUnsubPost = '') {
  const links = [...listUnsub.matchAll(/<([^>]+)>/g)].map((m) => m[1]);
  return {
    https: links.find((l) => l.startsWith('https://')),
    mailto: links.find((l) => l.startsWith('mailto:')),
    oneClick: /One-Click/i.test(listUnsubPost),
  };
}

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
//px of horizontal drag  
const THRESHOLD = 110;   

function SenderCard({ senders, onDecision }) {
  const [i, setI] = useState(0);
  const sender = senders[i];

  const drag = useRef({ active: false, startX: 0, dx: 0 });
  const card = useRef(null);

  const decide = (action) => {
    onDecision?.(sender, action);
    setI(n => n + 1);
  };

  //slide the card off screen in the chosen direction, then advance
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

    //fade in whichever label matches the direction of travel
    const strength = Math.min(Math.abs(dx) / THRESHOLD, 1);
    card.current.querySelector('.verdict-no').style.opacity = dx < 0 ? strength : 0;
    card.current.querySelector('.verdict-yes').style.opacity = dx > 0 ? strength : 0;
  };

  const onPointerUp = () => {
    const { active, dx } = drag.current;
    if (!active) return;
    drag.current.active = false;

    if (Math.abs(dx) > THRESHOLD) return flyOut(dx < 0 ? 'unsubscribe' : 'keep');

    //if you didnt drag far enogh then the card snaps back into place
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
    setLoadProgress('Loading your emails...');
    try {
      const onRetry = (seconds) => setLoadProgress(`Gmail is busy. Retrying in ${seconds}s...`);
      const q = encodeURIComponent('category:promotions OR unsubscribe');
      const listData = await gmailApi.fetchPromotions('category:promotions OR unsubscribe', onRetry);
      const details = await gmailApi.fetchMessageDetails(listData.messages || [], {
        onRetry,
        onProgress: (done, total) => setLoadProgress(`Loading emails: ${done} of ${total}...`),
      });

      const bySender = {};

      for (const msg of details) {
        const h = Object.fromEntries(
          (msg.payload?.headers || []).map((x) => [
            x.name.toLowerCase(),
            x.value,
          ])
        );

        if (!h['list-unsubscribe'] || !h.from) continue;

        const from = h.from;

        if (!bySender[from]) {
          bySender[from] = {
            from,
            count: 0,
            unread: 0,
            latest: null,
            ...parseUnsubscribe(
              h['list-unsubscribe'],
              h['list-unsubscribe-post']
            ),
          };
        }

        const sender = bySender[from];
        sender.count++;

        if ((msg.labelIds || []).includes('UNREAD')) {
          sender.unread++;
        }

        const timestamp = Number(msg.internalDate);

        if (!sender.latest || timestamp > sender.latest.timestamp) {
          sender.latest = {
            timestamp,
            subject: h.subject || '(No subject)',
            snippet: msg.snippet || 'No preview available.',
          };
        }
      }
      const ranked = Object.values(bySender)
        .map((s) => ({ ...s, opened: s.count - s.unread }))
        .sort((a, b) => b.count - a.count);

        //filters the email you already unsubscribed from
      const filtered = [];
      for (const s of ranked) {
          const cleanEmail = s.from.match(/<([^>]+)>/)?.[1] || s.from;
          if (!(await isAlreadyUnsubscribed(cleanEmail)) && !(await isAlreadyKept(cleanEmail))) 
            {
             filtered.push(s);
          }
      }
      setSenders(filtered);
    } catch (err) {
      console.error('Failed to load emails:', err);
      setLoadError(err.message || 'Failed to load emails. Please try again.');

      if (err.message.includes('session expired') || err.message.includes('401')) {
        setIsAuthenticated(false); //Reset back to login
        setStatus('Session expired. Please log in again.');
      }
    } finally {
      loadInFlight.current = false;
      setLoading(false);
      setLoadProgress('');
    }
  };

  const handleUnsubscribe = async (s) => {
    try {
      const cleanEmail = s.from.match(/<([^>]+)>/)?.[1] || s.from;
      await saveUnsubscribedEmail(cleanEmail); //save to mem when they click unsubscribed
      
      if (s.https) {
        if (window.desktopAPI?.unsubscribe) {
          const result = await window.desktopAPI.unsubscribe({ url: s.https, oneClick: s.oneClick });

          if (!result.ok) throw new Error(result.error || `HTTPS Unsubscribe Failed: ${result.status}`);
          setStatus(`Unsubscribe email sent to ${s.from}`);
        } else {
          window.open(s.https, '_blank');
        }
      } else if (s.mailto) {
        const ok = await gmailApi.sendUnsubscribeEmail(s.mailto);
        setStatus(`Unsubscribe email sent to ${s.from}`);
      }
    } catch (err) {
      console.error(err);
      setStatus('Unsubscribe failed. Check the console.');
      setFailed((f) => [...f, s.from]);
    }
  };
    const scheduleUnsubscribe = async (s) => {

    const cleanEmail = s.from.match(/<([^>]+)>/)?.[1] || s.from;
    await saveUnsubscribedEmail(cleanEmail);
    
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
    
    // REMOVE FROM YOUR MEMORY
    const cleanEmail = s.from.match(/<([^>]+)>/)?.[1] || s.from;
    await removeUnsubscribedEmail(cleanEmail);

    setStatus(`Cancelled unsubscribe for ${s.from}`);
  };

  const handleDecision = async (sender, action) => {
    const cleanEmail = sender.from.match(/<([^>]+)>/)?.[1] || sender.from;
    
    if (action === 'unsubscribe') {
      scheduleUnsubscribe(sender); // This starts her timer
    } else {
      await saveKeptEmail(cleanEmail); 
      setStatus(`Kept ${sender.from}`);
    }
  
  };

  return (
      <div style={{ padding: 20, textAlign: 'center', fontFamily: 'sans-serif', overflowX: 'hidden' }}>
        <div style={{display: 'flex', flexDirection: 'row', justifyContent:'center'}}>
          <h1>MailBroom</h1>
          {isAuthenticated ? (<RefreshLogo size={60} onRefresh={() => loadSenders(isAuthenticated)} />) : null}
        </div>

      {!isAuthenticated ? (
        <button disabled={loading} onClick={handleLogin} style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer' }}>
          {loading ? 'Signing in...' : 'Login with Google'}
        </button>
      ) : (
        <div>
          {loading && <p role="status">{loadProgress || 'Loading your emails...'}</p>}
          {loadError && !loading && (
            <div role="alert">
              <p>{loadError}</p>
              <button onClick={() => loadSenders(isAuthenticated)}>Retry loading emails</button>
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
