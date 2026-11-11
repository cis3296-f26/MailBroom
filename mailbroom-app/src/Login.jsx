export default function Login({ onLogin, loading }) {
  return (
    <button 
      disabled={loading} 
      onClick={onLogin} 
      style={{ padding: '10px 20px', fontSize: '16px', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}
    >
      {loading ? 'Signing in...' : 'Login with Google'}
    </button>
  );
}