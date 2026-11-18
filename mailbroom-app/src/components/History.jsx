import { useState } from 'react';
import { getSenderIdentity } from '../senderIdentity';
import { summarizeHistory } from '../history';
import trashIcon from '../assets/trash_icon.png';
import './HistoryTrash.css';

const labels = { kept: 'Kept', requested: 'Unsubscribe requested', filtered: 'Filtered from inbox' };

function HistoryItem({ entry, onTrashSender }) {
  const identity = getSenderIdentity(entry.from);
  const [failed, setFailed] = useState(false);
  const [confirmingTrash, setConfirmingTrash] = useState(false);
  const [trashing, setTrashing] = useState(false);
  const [trashComplete, setTrashComplete] = useState(false);
  const [trashMessage, setTrashMessage] = useState('');
  const [trashError, setTrashError] = useState('');

  const trashMessages = async () => {
    setConfirmingTrash(false);
    setTrashing(true);
    setTrashMessage('');
    setTrashError('');
    try {
      const result = await onTrashSender(entry);
      if (result.found === 0 || result.failed === 0) setTrashComplete(true);
      if (result.found === 0) {
        setTrashMessage('No matching inbox messages were found.');
      } else if (result.failed > 0) {
        setTrashMessage(`Moved ${result.trashed} of ${result.found} messages to Trash; ${result.failed} could not be moved.`);
      } else {
        setTrashMessage(`Moved ${result.trashed} message${result.trashed === 1 ? '' : 's'} to Trash.`);
      }
    } catch (error) {
      if (error?.name !== 'AbortError') {
        setTrashError(error?.message || 'Could not move messages to Trash. Please try again.');
      }
    } finally {
      setTrashing(false);
    }
  };

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
      {entry.outcome !== 'kept' && (
        <>
          <div className="history-trash-action">
            {!confirmingTrash && !trashComplete && (
              <button
                className="history-trash-button"
                type="button"
                aria-label={`Trash inbox messages from ${identity.email}`}
                title="Trash inbox messages"
                disabled={trashing}
                onClick={() => {
                  setTrashMessage('');
                  setTrashError('');
                  setConfirmingTrash(true);
                }}
              >
                <img src={trashIcon} alt="" />
              </button>
            )}
          </div>
          {confirmingTrash && (
            <div className="history-trash-confirm" role="group" aria-label={`Confirm moving messages from ${identity.email} to Trash`}>
              <p>Move all inbox messages from {identity.email} to Trash?</p>
              <div className="history-trash-confirm-actions">
                <button type="button" disabled={trashing} onClick={trashMessages}>Move to Trash</button>
                <button type="button" disabled={trashing} onClick={() => setConfirmingTrash(false)}>Cancel</button>
              </div>
            </div>
          )}
          {trashing && <p className="history-trash-progress" role="status">Moving to Trash…</p>}
          {trashMessage && <p className="history-trash-result" role="status">{trashMessage}</p>}
          {trashError && <p className="history-trash-result" role="alert">{trashError}</p>}
        </>
      )}
    </li>
  );
}

export default function History({ entries, loading, error, onRetry, onHome, authenticated, onTrashSender }) {
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
            <ul className="history-list">{summary.entries.map((entry) => <HistoryItem key={entry.email} entry={entry} onTrashSender={onTrashSender} />)}</ul>
          ) : (
            <div className="history-empty"><h2>{entries.length ? `No ${filter} senders yet` : 'A fresh start'}</h2><p>{entries.length ? 'Try another filter to see your reviewed senders.' : 'Your decisions will appear here as you clean your inbox.'}</p>{!entries.length && <button className="login-button" onClick={onHome}>Start reviewing</button>}</div>
          )}
          <p className="history-note">Saved on this device. Unsubscribe requests may take time to take effect.</p>
        </>
      )}
    </section>
  );
}
