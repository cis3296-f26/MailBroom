const icons = {
  History: <><path d="M3 10a9 9 0 1 1 1 7M3 4v6h6" /><path d="M12 7v5l3 2" /></>,
  Home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v12h5v-7h4v7h5V9" /></>,
  Settings: <><path d="m10 3-.5 3-2 .9L5 5.8 2.8 9.5 5 11v2l-2.2 1.5L5 18.2l2.5-1.1 2 .9.5 3h4l.5-3 2-.9 2.5 1.1 2.2-3.7L19 13v-2l2.2-1.5L19 5.8l-2.5 1.1-2-.9-.5-3Z" /><circle cx="12" cy="12" r="3" /></>,
};

export default function BottomNav({ activePage = 'Home', onNavigate }) {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {['History', 'Home', 'Settings'].map((label) => (
        <button
          key={label}
          type="button"
          className="nav-item"
          aria-current={label === activePage ? 'page' : undefined}
          title={label}
          onClick={() => onNavigate?.(label)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {icons[label]}
          </svg>
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
