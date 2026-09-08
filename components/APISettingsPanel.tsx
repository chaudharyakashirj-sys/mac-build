import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { Input } from './Input';

interface APISettings {
  customApiUrl: string;
  autoDetect: boolean;
}

export const APISettingsPanel: React.FC<{
  onClose?: () => void;
  onSave?: () => void;
}> = ({ onClose, onSave }) => {
  const [settings, setSettings] = useState<APISettings>({
    customApiUrl: localStorage.getItem('custom_api_url') || '',
    autoDetect: localStorage.getItem('auto_detect_api') !== 'false',
  });

  const [testStatus, setTestStatus] = useState<{
    status: 'idle' | 'testing' | 'success' | 'error';
    message: string;
  }>({ status: 'idle', message: '' });

  const handleSave = () => {
    localStorage.setItem('custom_api_url', settings.customApiUrl);
    localStorage.setItem('auto_detect_api', String(settings.autoDetect));
    
    setTestStatus({
      status: 'success',
      message: 'Settings saved! Page will reload in 2 seconds...',
    });

    setTimeout(() => {
      window.location.reload();
    }, 2000);

    onSave?.();
  };

  const handleTest = async () => {
    if (!settings.customApiUrl) {
      setTestStatus({
        status: 'error',
        message: 'Please enter an API URL',
      });
      return;
    }

    setTestStatus({ status: 'testing', message: 'Testing connection...' });

    try {
      const url = settings.customApiUrl.replace(/\/+$/, '');
      // Fixed: Correct endpoint is /health not /api/auth/health
      const response = await fetch(`${url}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        setTestStatus({
          status: 'success',
          message: '✅ Server connection successful!',
        });
      } else {
        setTestStatus({
          status: 'error',
          message: `❌ Server returned ${response.status}`,
        });
      }
    } catch (error) {
      setTestStatus({
        status: 'error',
        message: `❌ Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  };

  return (
    <div className="api-settings-panel" style={{
      padding: '20px',
      border: '1px solid #ddd',
      borderRadius: '8px',
      backgroundColor: '#f9f9f9',
      maxWidth: '500px',
      margin: '20px auto',
    }}>
      <h2 style={{ marginTop: 0 }}>🔌 API Server Settings</h2>

      <div style={{ marginBottom: '15px' }}>
        <Input
          label="Custom API URL"
          type="text"
          placeholder="http://hrserver.local:3001 or http://192.168.1.100:3001"
          value={settings.customApiUrl}
          onChange={(e) =>
            setSettings({ ...settings, customApiUrl: e.target.value })
          }
          style={{ width: '100%', padding: '8px' }}
        />
        <small style={{ display: 'block', marginTop: '5px', color: '#666' }}>
          Leave empty to use automatic detection on Jio/Airtel WiFi
        </small>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="checkbox"
            checked={settings.autoDetect}
            onChange={(e) =>
              setSettings({ ...settings, autoDetect: e.target.checked })
            }
          />
          Auto-detect server (try multiple IPs)
        </label>
        <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
          ✅ Recommended: Works with Jio, Airtel, and VPN
        </small>
      </div>

      {testStatus.status !== 'idle' && (
        <div
          style={{
            padding: '10px',
            marginBottom: '15px',
            borderRadius: '4px',
            backgroundColor:
              testStatus.status === 'success'
                ? '#d4edda'
                : testStatus.status === 'error'
                ? '#f8d7da'
                : '#e2e3e5',
            color:
              testStatus.status === 'success'
                ? '#155724'
                : testStatus.status === 'error'
                ? '#721c24'
                : '#383d41',
            border: `1px solid ${
              testStatus.status === 'success'
                ? '#c3e6cb'
                : testStatus.status === 'error'
                ? '#f5c6cb'
                : '#d6d8db'
            }`,
          }}
        >
          {testStatus.message}
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
        <Button onClick={handleTest} disabled={testStatus.status === 'testing'}>
          {testStatus.status === 'testing' ? '⏳ Testing...' : '🔍 Test Connection'}
        </Button>
        <Button onClick={handleSave} style={{ backgroundColor: '#28a745' }}>
          💾 Save Settings
        </Button>
        {onClose && <Button onClick={onClose}>✕ Close</Button>}
      </div>

      <hr style={{ margin: '20px 0', borderColor: '#ddd' }} />

      <details style={{ fontSize: '13px', color: '#666' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
          📚 Troubleshooting Tips
        </summary>
        <ul style={{ marginTop: '10px' }}>
          <li><strong>WiFi Changed:</strong> App auto-detects in 5 seconds. If not working, try manual entry.</li>
          <li><strong>Jio WiFi:</strong> Try: http://192.168.1.1:3001</li>
          <li><strong>Airtel WiFi:</strong> Try: http://192.168.0.1:3001</li>
          <li><strong>Hostname:</strong> If server has mDNS enabled: http://hrserver.local:3001</li>
          <li><strong>Check Router IP:</strong> Usually printed on router label (e.g., 192.168.1.1)</li>
        </ul>
      </details>

      <div style={{
        marginTop: '15px',
        padding: '10px',
        backgroundColor: '#fff3cd',
        border: '1px solid #ffc107',
        borderRadius: '4px',
        fontSize: '12px',
      }}>
        <strong>💡 Pro Tip:</strong> If you set up a static hostname or DDNS on your server, 
        you can use the same URL from anywhere (home, office, mobile hotspot). 
        Contact your IT admin for setup details.
      </div>
    </div>
  );
};

export default APISettingsPanel;
