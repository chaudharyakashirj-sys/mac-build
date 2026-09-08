import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode
} from 'react';
import { User } from '../types';
import * as api from '../api/http';


interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);

  /* =========================
     🔁 RESTORE SESSION ON REFRESH
  ========================= */
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');

    if (storedUser && token && String(token || '').trim() && String(storedUser || '').trim()) {
      try {
        const parsed = JSON.parse(storedUser);
        // Validate user object has required fields
        if (parsed && parsed.id && parsed.email) {
          // ✅ ENSURE id is always a string
          parsed.id = String(parsed.id);
          setUser(parsed);

        } else {
          // Invalid user object → clear
          localStorage.removeItem('user');
          localStorage.removeItem('token');
        }
      } catch (err) {
        // Corrupted storage → clear
        // Corrupted user data
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      }
    }

    // ✅ Listen for 401 events dispatched by the API client (safe Electron alternative to window.location.href)
    const handleUnauthorized = () => {
      // Auth unauthorized
      setUser(null);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  /* =========================
     LOGIN
  ========================= */
  const login = async (email: string, password: string) => {
    try {
      const res = await api.login(email, password);

      if (res?.token && res?.user) {
        // ✅ ENSURE id is always a string
        res.user.id = String(res.user.id);
        localStorage.setItem('token', res.token);
        localStorage.setItem('user', JSON.stringify(res.user));
        setUser(res.user);
        

      } else if (res) {
        // Fallback (should rarely happen) — API didn't return the standard { token, user } shape
        if (res.id) res.id = String(res.id);
        // ✅ BUG FIX #5: Also store token in fallback path so page refresh doesn't clear the session.
        // Previously only 'user' was stored without 'token', causing AuthContext restore to fail.
        if (res.token) {
          localStorage.setItem('token', res.token);
        }
        localStorage.setItem('user', JSON.stringify(res));
        setUser(res);
        

      }
    } catch (err) {
      // Re-throw with better error message detection
      if (err instanceof Error) {
        const errorMsg = err.message.toLowerCase();
        
        // Detect connection errors
        if (errorMsg.includes('failed to fetch') || 
            errorMsg.includes('econnrefused') || 
            errorMsg.includes('connection refused') ||
            errorMsg.includes('localhost') ||
            errorMsg.includes('net::err_connection_refused')) {
          const e = new Error(
            '❌ Cannot connect to server. Please ensure the backend is running and reachable.'
          );
          throw e;
        }
      }
      throw err;
    }
  };

  /* =========================
     LOGOUT
  ========================= */
  const logout = async () => {
    // ✅ Revoke Sanctum token on the backend before clearing local state
    try {
      await api.logout();
    } catch (_) {
      // Ignore errors — proceed with local cleanup regardless
    }
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        isAuthenticated: !!user
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
