import broomImg from '../assets/Broom.png';

export default function LoadingBroom({ message = 'Loading your emails...' }) {
  return (
    <div className="loading-broom" role="status">
      <img className="loading-broom-icon" src={broomImg} alt="" width="88" height="88" />
      <p>{message}</p>
    </div>
  );
}
