import { useState } from 'react';

export default function SenderCard({ senders, onDecision }) {
  const [i, setI] = useState(0);
  const sender = senders[i];

  const decide = (action) => {
    onDecision?.(sender, action);
    setI(n => n + 1);
  };

  if (!sender) {
    return <p className="card-done">All done. Reviewed {i} senders.</p>;
  }

  return (
    <>
      <div className="card-progress">{i} of {senders.length} reviewed</div>

      <div className="card">
        <div className="card-from">{sender.from}</div>
        <div className="card-stats">
          {sender.count} message{sender.count === 1 ? '' : 's'} · {sender.opened} opened
        </div>
        {sender.opened === 0 && <div className="card-never">never opened</div>}
      </div>

      <div className="card-buttons">
        <button className="btn-unsub" onClick={() => decide('unsubscribe')}>Unsubscribe</button>
        <button className="btn-keep" onClick={() => decide('keep')}>Keep</button>
      </div>
    </>
  );
}