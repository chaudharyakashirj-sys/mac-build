const { app, BrowserWindow, ipcMain, powerMonitor, Notification } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';

let mainWindow;

/* ================= SYSTEM NOTIFICATIONS ================= */
function showSystemNotification(title, body) {
  if (Notification.isSupported()) {
    const notification = new Notification({
      title: title,
      body: body,
      icon: path.join(__dirname, '../../assets/icon.png'),
      silent: false
    });

    notification.on('click', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    });

    notification.show();
  } else {
    console.log(`[Notification Fallback] ${title}: ${body}`);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
      // SECURITY: webSecurity is enabled. For dev-time CORS workarounds, allow
      // a specific list of APIs via the request handler below, do NOT disable webSecurity.
      webSecurity: true,
      // Block remote content / iframe injection by tightening the sandbox.
      sandbox: true
    },
    icon: path.join(__dirname, '../../assets/icon.png')
  });

  if (isDev) {
    // In dev, load Vite's dev server
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // In prod, load the built index.html
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // ✅ Block any navigation that tries to leave the app (e.g. window.location.href = '/login')
  // In file:// mode, such navigations would break the app entirely.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const appUrl = mainWindow.webContents.getURL();
    // Allow reloads (same URL) but block everything else in production
    if (!isDev && url !== appUrl) {
      console.log('[Electron] Blocked navigation to:', url);
      event.preventDefault();
    }
  });

  // ✅ If load fails for any reason, reload the app
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, _errorDescription, validatedURL) => {
    if (errorCode !== -3) { // -3 = ERR_ABORTED (user navigated away), ignore
      console.error('[Electron] Load failed:', errorCode, validatedURL);
      if (!isDev) {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
      }
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/* ================= TRACKING LOGIC ================= */
let trackingInterval;
let trackingData = {
  activeSeconds: 0,
  idleSeconds: 0,
  meetingSeconds: 0,
  meetingCount: 0,
  isMeetingMode: false,
  breakSeconds: 0,
  breakCount: 0,
  isBreakMode: false,
};
let isTracking = false;
let normalElapsed = 0; // Tracks total seconds spent in normal tracking mode
let warningNotificationShown = false;
const AUTO_OFF_IDLE_SECONDS = 300; // 5 minutes

ipcMain.handle('startTracking', () => {
  if (isTracking) return trackingData;
  isTracking = true;
  normalElapsed = 0;
  warningNotificationShown = false;

  trackingData = {
    activeSeconds: 0,
    idleSeconds: 0,
    meetingSeconds: 0,
    meetingCount: 0,
    isMeetingMode: false,
    breakSeconds: 0,
    breakCount: 0,
    isBreakMode: false,
  };

  if (trackingInterval) clearInterval(trackingInterval);

  trackingInterval = setInterval(() => {
    if (!isTracking) return;

    // Get system-wide idle time in seconds
    const systemIdleTime = powerMonitor.getSystemIdleTime();

    if (trackingData.isMeetingMode || trackingData.isBreakMode) {
      if (trackingData.isMeetingMode) trackingData.meetingSeconds++;
      if (trackingData.isBreakMode) trackingData.breakSeconds++;
      trackingData.activeSeconds++; // Meeting/Break counts as active work
      trackingData.idleSeconds = 0;
    } else {
      normalElapsed++; // Increment total time spent in normal mode

      if (systemIdleTime >= AUTO_OFF_IDLE_SECONDS) {
        console.log(`[Electron] Auto-stop triggered! Idle: ${systemIdleTime}s`);
        isTracking = false;
        clearInterval(trackingInterval);

        // Show OS notification for auto-offline
        showSystemNotification(
          'Session Ended Automatically',
          'You were marked offline due to 5 minutes of inactivity.'
        );

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('autoStop');
        }
        return;
      }

      // Warn 1 minute before auto-off threshold (at 240 seconds / 4 minutes)
      const WARNING_THRESHOLD = AUTO_OFF_IDLE_SECONDS - 60;
      if (systemIdleTime >= WARNING_THRESHOLD) {
        if (!warningNotificationShown) {
          const remainingSeconds = AUTO_OFF_IDLE_SECONDS - systemIdleTime;
          showSystemNotification(
            'Idle Time Warning',
            `You have been inactive. You will be automatically marked offline in ${remainingSeconds} seconds.`
          );
          warningNotificationShown = true;
        }
      } else {
        // Reset warning notification flag when user returns to activity
        warningNotificationShown = false;
      }

      // Update idle time based on system
      trackingData.idleSeconds = systemIdleTime;
      // Active time is all the elapsed time MINUS the current idle time
      trackingData.activeSeconds = Math.max(0, normalElapsed - trackingData.idleSeconds);
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('trackingUpdate', trackingData);
    }
  }, 1000);

  return trackingData;
});

ipcMain.handle('stopTracking', () => {
  isTracking = false;
  warningNotificationShown = false;
  if (trackingInterval) {
    clearInterval(trackingInterval);
    trackingInterval = null;
  }
  return trackingData;
});

ipcMain.handle('setMeetingMode', (event, isMeetingMode) => {
  trackingData.isMeetingMode = isMeetingMode;
  if (isMeetingMode) {
    trackingData.idleSeconds = 0;
    trackingData.meetingCount++;
  }
});

ipcMain.handle('setBreakMode', (event, isBreakMode) => {
  trackingData.isBreakMode = isBreakMode;
  if (isBreakMode) {
    trackingData.idleSeconds = 0;
    trackingData.breakCount++;
  }
});

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('HR Management Tracker');
  }
  createWindow();
});


app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
