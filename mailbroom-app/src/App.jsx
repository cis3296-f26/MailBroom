import { useState } from 'react';

export default function App() {
  const [token, setToken] = useState(null);

  const handleLogin = async () => {
    try {
      // This calls the bridge we exposed in electron/src/preload.ts
      const accessToken = await window.desktopAPI.loginWithGoogle();
      console.log("Success! Token:", accessToken);
      setToken(accessToken);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  return (
    <div style={{ padding: 20, textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h1>MailBroom</h1>
      
      {!token ? (
        <button 
          onClick={handleLogin}
          style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer' }}
        >
          Login with Google
        </button>
      ) : (
        <div>
          <h2>Logged In!</h2>
          <p>Your access token is ready to fetch emails.</p>
        </div>
      )}
    </div>
  );
}