import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import logoUrl from '../logo.svg';

const REMEMBER_EMAIL_KEY = 'remember_email';
const REMEMBER_ME_KEY = 'remember_me';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  /* ============================================================
     REMEMBER ME — Load saved email on mount
  ============================================================ */
  useEffect(() => {
    const savedRemember = localStorage.getItem(REMEMBER_ME_KEY) === 'true';
    const savedEmail = localStorage.getItem(REMEMBER_EMAIL_KEY) || '';
    setRememberMe(savedRemember);
    if (savedRemember && savedEmail) {
      setEmail(savedEmail);
    }
  }, []);

  /* ============================================================
     SUBMIT
  ============================================================ */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);

      // Save or clear email based on Remember Me checkbox
      if (rememberMe) {
        localStorage.setItem(REMEMBER_ME_KEY, 'true');
        localStorage.setItem(REMEMBER_EMAIL_KEY, email);
      } else {
        localStorage.removeItem(REMEMBER_ME_KEY);
        localStorage.removeItem(REMEMBER_EMAIL_KEY);
      }
    } catch (err) {
      let msg = 'Invalid email or password. Please try again.';
      if (err instanceof Error) {
        const m = err.message;
        if (
          m.includes('Cannot connect to server') ||
          m.includes('Failed to fetch') ||
          m.includes('connection refused') ||
          m.toLowerCase().includes('econnrefused')
        ) {
          msg = '⚠️ Cannot reach the server. Please check your internet connection or try again later.';
        } else {
          msg = m;
        }
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (setter: React.Dispatch<React.SetStateAction<string>>, value: string) => {
    setter(value);
    if (error) setError('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg border border-gray-200">

        {/* HEADER */}
        <div className="text-center">
          <div className="mx-auto w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-md">
            <img src={logoUrl} alt="Logo" className="w-10 h-10 object-contain rounded-xl" />
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900">Sign in</h2>
          <p className="mt-2 text-sm text-gray-600">
            HR Productivity &amp; Time Tracker
          </p>
        </div>

        {/* FORM */}
        <form className="mt-8 space-y-5" onSubmit={handleSubmit} autoComplete="on">

          {/* Email — autocomplete="username" tells the browser this is a login form */}
          <Input
            label="Email Address"
            type="email"
            name="username"
            autoComplete="username"
            value={email}
            onChange={(e) => handleInputChange(setEmail, e.target.value)}
            required
            placeholder="Enter your email"
          />

          {/* Password */}
          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            name="password"
            autoComplete={rememberMe ? 'current-password' : 'current-password'}
            value={password}
            onChange={(e) => handleInputChange(setPassword, e.target.value)}
            required
            placeholder="Enter your password"
            rightElement={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-gray-400 hover:text-gray-600 focus:outline-none"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            }
          />

          {/* ============================================================
               REMEMBER ME CHECKBOX
          ============================================================ */}
          <div className="flex items-center justify-between">
            <label
              htmlFor="remember-me"
              className="flex items-center gap-2.5 cursor-pointer select-none group"
            >
              <div className="relative">
                <input
                  id="remember-me"
                  type="checkbox"
                  className="sr-only"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                {/* Custom styled checkbox */}
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-150 ${rememberMe
                    ? 'bg-blue-600 border-blue-600'
                    : 'bg-white border-gray-300 group-hover:border-blue-400'
                    }`}
                  onClick={() => setRememberMe(!rememberMe)}
                >
                  {rememberMe && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
              <span className="text-sm text-gray-600 group-hover:text-gray-800 transition-colors">
                Remember my email
              </span>
            </label>

            {/* Saved indicator */}
            {rememberMe && email && (
              <span className="text-xs text-blue-500 flex items-center gap-1 font-medium">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Email saved
              </span>
            )}
          </div>

          {/* ERROR */}
          {error && (
            <div className={`text-sm p-3 rounded border ${error.includes('Cannot reach') || error.includes('Cannot connect')
              ? 'bg-yellow-50 border-yellow-300 text-yellow-800'
              : 'bg-red-50 border-red-100 text-red-600'
              }`}>
              {error}
            </div>
          )}

          {/* SUBMIT */}
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Signing in...
              </span>
            ) : 'Sign in'}
          </Button>

          {/* BROWSER AUTOFILL HINT */}
          <p className="text-center text-xs text-gray-400 mt-1">
            Your browser may also offer to save your password automatically.
          </p>

        </form>
      </div>
    </div>
  );
};