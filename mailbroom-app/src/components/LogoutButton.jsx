import { useState } from 'react';
import './LogoutButton.css';

export default function LogoutButton({
  onLogout,
  disabled = false,
  className = '',
  label = 'Sign out',
}) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleClick = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await onLogout?.();
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <button
      type="button"
      className={`logout-button ${className}`.trim()}
      onClick={handleClick}
      disabled={disabled || isLoggingOut}
      title="Sign out"
      aria-label="Sign out"
    >
      {isLoggingOut ? 'Signing out...' : label}
    </button>
  );
}
