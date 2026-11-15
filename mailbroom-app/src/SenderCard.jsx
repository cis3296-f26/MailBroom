import { useEffect, useState, useRef } from 'react';
import { getSenderIdentity } from './senderIdentity';
import { swipeAction } from './settings';

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

export default function SenderCard({ senders, onDecision, swipePreference = 'both' }) {
  const [i, setI] = useState(0);
  const sender = senders[i];
  
  const drag = useRef({ active: false, startX: 0, dx: 0 });
  const card = useRef(null);
  const animationTimer = useRef(null);
  const deciding = useRef(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => () => clearTimeout(animationTimer.current), []);

  const decide = (action) => {
    onDecision?.(sender, action);
    setI(n => n + 1);
    deciding.current = false;
    setAnimating(false);
  };

  // slide the card off screen in the chosen direction, then advance
  const flyOut = (action) => {
    if (deciding.current) return;
    deciding.current = true;
    setAnimating(true);
    const el = card.current;
    if (!el) return decide(action);
    const leftAction = swipeAction(-1, swipePreference) || 'unsubscribe';
    const x = action === leftAction ? -600 : 600;
    el.style.transition = 'transform .3s ease, opacity .3s ease';
    el.style.transform = `translate(${x}px, 40px) rotate(${x / 18}deg)`;
    el.style.opacity = 0;
    animationTimer.current = setTimeout(() => decide(action), 280);
  };

  const onPointerDown = (e) => {
    if (swipePreference === 'buttons' || deciding.current || e.target.closest('button') || e.button !== 0) return;
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
    const action = swipeAction(dx, swipePreference);
    card.current.querySelector('.verdict-no').style.opacity = action === 'unsubscribe' ? strength : 0;
    card.current.querySelector('.verdict-yes').style.opacity = action === 'keep' ? strength : 0;
  };

  const onPointerUp = () => {
    const { active, dx } = drag.current;
    if (!active) return;
    drag.current.active = false;

    if (Math.abs(dx) > THRESHOLD) return flyOut(swipeAction(dx, swipePreference));

    // if you didn't drag far enough then the card snaps back into place
    card.current.style.transition = 'transform .3s ease';
    card.current.style.transform = 'translate(0,0) rotate(0)';
    card.current.querySelector('.verdict-no').style.opacity = 0;
    card.current.querySelector('.verdict-yes').style.opacity = 0;
  };

  if (!sender) {
    return <section className="card-done" role="status"><h2>All swept up.</h2><p>You reviewed {i} senders. Your inbox thanks you.</p></section>;
  }

  const identity = getSenderIdentity(sender.from);

  return (
    <section className="sender-review" aria-label="Review senders">
      <div className="card-progress" role="status">{i} of {senders.length} reviewed</div>

      {/* Reset swipe styles when the sender changes */}
      <article
        key={sender.from}
        ref={card}
        className="card"
        data-swipe={swipePreference}
        tabIndex={swipePreference !== 'buttons' ? 0 : undefined}
        aria-label={`Review ${identity.name}`}
        aria-keyshortcuts={swipePreference !== 'buttons' ? 'ArrowLeft ArrowRight' : undefined}
        onKeyDown={(event) => {
          if (swipePreference === 'buttons' || event.target !== event.currentTarget) return;
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault();
            flyOut(event.key === 'ArrowLeft' ? 'unsubscribe' : 'keep');
          }
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          drag.current.active = false;
          if (card.current && !deciding.current) {
            card.current.style.transform = '';
            card.current.querySelector('.verdict-no').style.opacity = 0;
            card.current.querySelector('.verdict-yes').style.opacity = 0;
          }
        }}
      >
        <div className="verdict verdict-no verdict-left">UNSUBSCRIBE</div>
        <div className="verdict verdict-yes verdict-right">KEEP</div>

        <div className="sender-heading">
          <SenderAvatar key={sender.from} identity={identity} />
          <div className="sender-details">
            <h2 className="card-from">{identity.name}</h2>
            {identity.name !== identity.email && (
              <div className="sender-email">{identity.email}</div>
            )}
          </div>
        </div>
        <div className="card-stats">
          {sender.count} message{sender.count === 1 ? '' : 's'} · {sender.opened === 0 ? 'never opened' : `${sender.opened} opened`}
        </div>
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

      {swipePreference === 'swipe' ? (
        <p className="swipe-hint">Swipe left to unsubscribe · right to keep</p>
      ) : <div className="card-buttons">
        <button className="btn-unsub" disabled={animating} onClick={() => flyOut('unsubscribe')}>Unsubscribe</button>
        <button className="btn-keep" disabled={animating} onClick={() => flyOut('keep')}>Keep</button>
      </div>}
      </article>
    </section>
  );
}
