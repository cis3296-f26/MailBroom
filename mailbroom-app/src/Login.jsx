export default function Login({ onLogin, loading }) {
  return (
    <button 
      disabled={loading} 
      onClick={onLogin} 
      className="login-button"
    >
      {loading ? 'Signing in...' : 'Login with Google'}
    </button>
  );
}
