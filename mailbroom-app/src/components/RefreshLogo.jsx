import { useState } from 'react';
import './RefreshLogo.css';

export default function RefreshLogo({ onRefresh }) {
  const [isFetching, setIsFetching] = useState(false);

  const handleClick = async () => {
    setIsFetching(true);

    try {
      await onRefresh();
    } finally {
      setIsFetching(false);
    }
  };

  return (
    <button
      type="button"
      className="refresh-button"
      title="Refresh emails"
      aria-label="Refresh emails"
      onClick={handleClick}
      disabled={isFetching}
    >
      Refresh
    </button>
  );
}
