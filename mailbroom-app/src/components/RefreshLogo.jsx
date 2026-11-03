import { useState } from 'react';
import broomImg from '@assets/Broom.png'; 
import './RefreshLogo.css';

export default function RefreshLogo({size = 50, onRefresh}) {
  const [isFetching, setIsFetching] = useState(false);
  const [rotation, setRotation] = useState(0);

  const handleClick = async () => {
    setIsFetching(true);
    setRotation(prev => prev + 360);

    try {
      await onRefresh();
    } finally {
      setIsFetching(false);
    }
  };

  const handleTransitionEnd = () => {
    if(isFetching) {
      setRotation(prev => prev + 360);
    }
  };

  return (
    <button
      type="button"
      className="broom-refresh"
      title="Refresh emails"
      aria-label="Refresh emails"
      onClick={handleClick}
      disabled={isFetching}
      style={{width: size, height: size}}
    >
      <svg
        className={`broom-icon ${isFetching ? 'spinning' : ''}`}
        aria-hidden="true"
        onTransitionEnd={handleTransitionEnd}
        style={{
          width: '100%',
          height: '100%',
          transformOrigin: 'center',
          transform: `rotate(${rotation}deg)`,
          transition: 'transform 0.8s linear'
        }}
        width={size} height={size}
      >
        <image href={broomImg} width='100%' height='100%'/>
      </svg>
    </button>
  );
}