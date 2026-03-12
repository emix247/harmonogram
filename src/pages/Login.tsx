import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { Lock } from 'lucide-react';

interface Props {
  onLogin: (userId: string) => void;
}

export default function Login({ onLogin }: Props) {
  const { users } = useAppStore();
  const [loginName, setLoginName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Check against store users (custom credentials set in Settings)
    const user = users.find(
      u => u.loginName === loginName && u.password === password
    );
    // Fallback: built-in default admin (works even with old localStorage data)
    const isDefault = loginName === 'admin' && password === 'tesgrup2024';
    if (user || isDefault) {
      const userId = user?.id ?? 'u1';
      sessionStorage.setItem('harmonogram-auth', userId);
      onLogin(userId);
    } else {
      setError('Nesprávné přihlašovací údaje');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center shrink-0">
            <span className="text-white font-black text-lg">T</span>
          </div>
          <div>
            <h1 className="font-black text-white text-xl leading-tight">Tesgrup</h1>
            <p className="text-blue-400 font-semibold text-sm leading-tight">Development</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-2xl">
          <div className="flex items-center gap-2 mb-5">
            <Lock size={18} className="text-gray-400" />
            <h2 className="font-semibold text-gray-800">Přihlášení do systému</h2>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Přihlašovací jméno</label>
              <input
                type="text"
                value={loginName}
                onChange={e => { setLoginName(e.target.value); setError(''); }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
                autoComplete="username"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Heslo</label>
              <input
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoComplete="current-password"
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
            >
              Přihlásit se
            </button>
          </form>
        </div>

        <p className="text-center text-gray-500 text-xs mt-4">Stavební Planovač v1.0</p>
      </div>
    </div>
  );
}
