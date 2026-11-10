import { useState, useRef } from 'react';
import { getSenderIdentity } from './senderIdentity';

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

export default function SenderCard({ senders, onDecision }) {
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