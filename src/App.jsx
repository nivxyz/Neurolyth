import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import Landing from './components/Landing';
import Auth from './components/Auth';
import AppShell from './components/AppShell';

export default function App() {
  const [screen, setScreen] = useState('loading');
  const [user, setUser] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => {
      setUser(u);
      setScreen(u ? 'app' : 'landing');
      document.body.classList.remove('auth-loading');
      document.body.classList.add('auth-ready');
    });
    return unsub;
  }, []);

  function showToast(msg, isErr = false) {
    setToast({ msg, isErr });
    setTimeout(() => setToast(null), 3800);
  }

  return (
    <>
      {screen === 'landing' && <Landing onSignIn={() => setScreen('auth')} />}
      {screen === 'auth' && (
        <Auth onBack={() => setScreen('landing')} onSuccess={() => {}} />
      )}
      {screen === 'app' && user && (
        <AppShell user={user} showToast={showToast} />
      )}
      {toast && (
        <div className={`app-toast show${toast.isErr ? ' err' : ''}`}>
          {toast.msg}
        </div>
      )}
    </>
  );
}
