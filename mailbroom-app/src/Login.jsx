export default function Login({ onLogin }) {
  return (
    <button onClick={onLogin} style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer' }}>
      Login with Google
    </button>
  );
}