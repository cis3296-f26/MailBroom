import { useState } from 'react';
import { getSenderIdentity } from '../senderIdentity';
import { summarizeHistory } from '../history';

const labels = { kept: 'Kept', requested: 'Unsubscribe requested', filtered: 'Filtered from inbox' };

function HistoryItem({ entry }) {
  const identity = getSenderIdentity(entry.from);
  const [failed, setFailed] = useState(false);
  return (
    <li className="history-item">
      <div className="history-avatar" aria-hidden="true">
        {identity.iconUrl && !failed
          ? <img src={identity.iconUrl} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
          : identity.initials}
      </div>
      <div className="history-sender">
        <h3>{identity.name}</h3>
        <p>{identity.email}</p>
        <span className={`history-badge ${entry.outcome === 'kept' ? 'is-kept' : 'is-removed'}`}>{labels[entry.outcome]}</span>
      </div>
    </li>
  );
}

export default function History({ entries, loading, error, onRetry, onHome, authenticated }) {
  const [filter, setFilter] = useState('all');
  const summary = summarizeHistory(entries, filter);
  return (
    <section className="history-page" aria-labelledby="history-heading">
      <div className="page-heading"><h1 id="history-heading">History</h1><p>Your inbox, a little lighter.</p></div>
      {!authenticated ? (
        <div className="history-empty"><h2>Your cleaning history</h2><p>Sign in to see the senders you’ve reviewed on this device.</p><button className="login-button" onClick={onHome}>Go to Home</button></div>
      ) : loading ? <p className="history-empty" role="status">Loading your history…</p> : error ? (
        <div className="history-empty" role="alert"><p>{error}</p><button className="login-button" onClick={onRetry}>Try again</button></div>
      ) : (
        <>
          <dl className="history-totals">
            {[['Reviewed', summary.reviewed], ['Kept', summary.kept], ['Removed', summary.removed]].map(([label, count]) => (
              <div key={label} className={`history-total total-${label.toLowerCase()}`}><dt>{label}</dt><dd>{count}</dd></div>
            ))}
          </dl>
          <div className="history-filters" role="group" aria-label="Filter history">
            {['all', 'kept', 'removed'].map((value) => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value === 'all' ? 'All' : value === 'kept' ? 'Kept' : 'Removed'}</button>)}
          </div>
          {summary.entries.length ? (
            <ul className="history-list">{summary.entries.map((entry) => <HistoryItem key={entry.email} entry={entry} />)}</ul>
          ) : (
            <div className="history-empty"><h2>{entries.length ? `No ${filter} senders yet` : 'A fresh start'}</h2><p>{entries.length ? 'Try another filter to see your reviewed senders.' : 'Your decisions will appear here as you clean your inbox.'}</p>{!entries.length && <button className="login-button" onClick={onHome}>Start reviewing</button>}</div>
          )}
          <p className="history-note">Saved on this device. Unsubscribe requests may take time to take effect.</p>
        </>
      )}
    </section>
  );
}
