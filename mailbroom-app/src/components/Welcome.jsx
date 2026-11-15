import mailbroomLogo from '../assets/mailbroomlogo.png';

export default function Welcome({ onStart }) {
  return (
    <main className="app-shell welcome-page" aria-labelledby="welcome-heading">
      <img className="welcome-logo" src={mailbroomLogo} alt="MailBroom" width="2159" height="728" />
      <section className="welcome-card">
        <span className="welcome-eyebrow">A fresh start for your inbox</span>
        <h1 id="welcome-heading">Welcome to<br />MailBroom.</h1>
        <p>Keep the emails you love.<br />Sweep away the rest.</p>
        <div className="welcome-divider" aria-hidden="true" />
        <p className="welcome-detail">A calmer inbox, one sender at a time.<br />You decide what stays.</p>
        <button className="welcome-start" type="button" onClick={onStart}>
          Start cleaning
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14m-6-6 6 6-6 6" />
          </svg>
        </button>
      </section>
    </main>
  );
}
