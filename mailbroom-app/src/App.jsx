import { useState, useRef } from 'react';
import { isAlreadyUnsubscribed, saveUnsubscribedEmail, isAlreadyKept, saveKeptEmail, removeUnsubscribedEmail } from './storage';
import './App.css';
import Login from './Login';
import UndoPopup from './UndoPopup';
import SenderCard from './SenderCard';

const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me';
const UNDO_MS = 6000; //time for the user to undo an unsubscribe action

function parseUnsubscribe(listUnsub = '', listUnsubPost = '') {
  const links = [...listUnsub.matchAll(/<([^>]+)>/g)].map((m) => m[1]);
  return {
    https: links.find((l) => l.startsWith('https://')),
    mailto: links.find((l) => l.startsWith('mailto:')),
    oneClick: /One-Click/i.test(listUnsubPost),
  };
}

async function sendMailto(token, mailto) {
  const url = new URL(mailto);
  const clean = (s) => s.replace(/[\r\n]/g, ''); // header values come from the sender, so strip newlines
  const to = clean(decodeURIComponent(url.pathname));
  const subject = clean(url.searchParams.get('subject') || 'unsubscribe');
  const raw = `To: ${to}\r\nSubject: ${subject}\r\n\r\nunsubscribe`;
  const encoded = btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const res = await fetch(`${GMAIL}/messages/send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: encoded }),
  });
  return res.ok;
}



export default function App() {
  const [token, setToken] = useState(null);
  const [senders, setSenders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const timers = useRef({});
  const [pending, setPending] = useState([]);

  const handleLogin = async () => {
    try {
      const accessToken = await window.desktopAPI.loginWithGoogle();
      setToken(accessToken);
      loadSenders(accessToken);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };
  const loadSenders = async (accessToken) => {
    setLoading(true);
    setStatus('');
    try {
      const headers = { Authorization: `Bearer ${accessToken}` };
      const q = encodeURIComponent('category:promotions OR unsubscribe');
      const listRes = await fetch(`${GMAIL}/messages?maxResults=50&labelIds=INBOX&q=${q}`, { headers });
      const listData = await listRes.json();
      console.log('LIST', listRes.status, listData);
      if (!listRes.ok) throw new Error(JSON.stringify(listData));
      const { messages = [] } = listData;

      const details = await Promise.all(
        messages.map((m) =>
          fetch(
            `${GMAIL}/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=List-Unsubscribe&metadataHeaders=List-Unsubscribe-Post`,
            { headers }
          ).then((r) => r.json())
        )
      );
      console.log('DETAILS', details.length, details[0]?.payload?.headers);

      const bySender = {};
      for (const msg of details) {
        const h = Object.fromEntries((msg.payload?.headers || []).map((x) => [x.name.toLowerCase(), x.value]));
        if (!h['list-unsubscribe']) continue; // skip senders with no unsubscribe option
        const from = h['from'];
        if (!bySender[from]) {
                    bySender[from] = {
            from,
            count: 0,
            unread: 0,
            ...parseUnsubscribe(h['list-unsubscribe'], h['list-unsubscribe-post']),
          };
          
        }
        bySender[from].count++;
        if ((msg.labelIds || []).includes('UNREAD')) bySender[from].unread++;
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
      setStatus('Failed to load emails. Check the console.');
    }
    setLoading(false);
  };
  

  const handleUnsubscribe = async (s) => {
    try {
      const cleanEmail = s.from.match(/<([^>]+)>/)?.[1] || s.from;
      await saveUnsubscribedEmail(cleanEmail); //save to mem when they click unsubscribed
      
      if (s.https) {
        if (window.desktopAPI?.unsubscribe) {
          const result = await window.desktopAPI.unsubscribe({ url: s.https, oneClick: s.oneClick });
          setStatus(result.ok ? `Unsubscribe sent for ${s.from}` : `Failed: ${result.error || result.status}`);
        } else {
          window.open(s.https, '_blank');
        }
      } else if (s.mailto) {
        const ok = await sendMailto(token, s.mailto);
        setStatus(ok ? `Unsubscribe email sent to ${s.from}` : 'Failed to send unsubscribe email');
      }
    } catch (err) {
      console.error(err);
      setStatus('Unsubscribe failed. Check the console.');
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
    <div style={{ padding: 20, textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h1>MailBroom</h1>

      {!token ? (
        <Login onLogin={handleLogin} />
      ) : (
        <div>
          {loading && <p>Loading your emails...</p>}
          {status && <p>{status}</p>}
            
          <UndoPopup pending={pending} onUndo={undoUnsubscribe} />
          
          {!loading && senders.length > 0 && (
            <SenderCard senders={senders} onDecision={handleDecision} />
          )}

          {!loading && senders.length === 0 && (
            <p>No senders with an unsubscribe option in your 50 most recent emails.</p>
          )}
        </div>
      )}
    </div>
  );
}