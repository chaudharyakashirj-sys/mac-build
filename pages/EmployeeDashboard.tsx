import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/Button';
import { Layout } from '../components/Layout';
import { AttendanceCalendar } from '../components/AttendanceCalendar';
import { LeaveRequestModal } from '../components/LeaveRequestModal';
import { LeaveRequest, LeaveStatus } from '../types';
import http from '../api/http'; // ← Changed to default import

export const EmployeeDashboard: React.FC = () => {
  const { user } = useAuth();

  /* ================= STATE ================= */
  const [isWorking, setIsWorking] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  // ✅ FIX: Ref so the interval closure always has the latest sessionId (not a stale closure)
  const sessionIdRef = React.useRef<string | null>(null);

  // Live session timers
  const [activeSeconds, setActiveSeconds] = useState<number>(0);
  const [idleSeconds, setIdleSeconds] = useState<number>(0);
  const [meetingSeconds, setMeetingSeconds] = useState<number>(0);
  const [isMeetingMode, setIsMeetingMode] = useState<boolean>(false);
  const meetingModeRef = React.useRef<boolean>(false);

  // Break Mode state (same as meeting mode - session idle doesn't run)
  const [breakSeconds, setBreakSeconds] = useState<number>(0);
  const [isBreakMode, setIsBreakMode] = useState<boolean>(false);
  const breakModeRef = React.useRef<boolean>(false);

  // ✅ BUG FIX #8: Use state (not ref) so React re-renders the auto-offline banner
  const [wasAutoStopped, setWasAutoStopped] = useState<boolean>(false);

  const startTimeRef = React.useRef<number | null>(null);
  const lastActivityRef = React.useRef<number>(0);
  const timerRef = React.useRef<number | null>(null);
  const activityHandlerRef = React.useRef<((event: Event) => void) | null>(null);
  const lastActivityTimeRef = React.useRef<number>(0);
  const ACTIVITY_THROTTLE_MS = 500;
  const autoStoppedRef = React.useRef<boolean>(false);
  const meetingSecondsRef = React.useRef<number>(0);
  const meetingCountRef = React.useRef<number>(0);
  const breakSecondsRef = React.useRef<number>(0);
  const breakCountRef = React.useRef<number>(0);
  const isPageVisibleRef = React.useRef<boolean>(true);
  const isElectronRef = React.useRef<boolean>(typeof window !== 'undefined' && !!(window as any).electron);
  // ✅ FIXED: Changed from 30 seconds (test value) to 5 minutes (300 seconds) for production
  const AUTO_OFF_IDLE_SECONDS = 300; // 5 minutes
  const lastMousePosRef = React.useRef<{ x: number, y: number }>({ x: 0, y: 0 });

  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [myLeaves, setMyLeaves] = useState<LeaveRequest[]>([]);
  // ✅ BUG FIX #16: Added leavesLoading state so the Recent Requests section shows a spinner
  const [leavesLoading, setLeavesLoading] = useState(false);

  // Activity card state
  const [activityStats, setActivityStats] = useState<any>(null);
  const [activityRange, setActivityRange] = useState<'today' | 'week' | 'month'>('today');
  // ✅ BUG FIX #13: Added statsLoading/statsError states for the activity card
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  const formatHMS = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const formatHours = (s: number) => (s / 3600).toFixed(1) + 'h';

  const getTodayTotalActiveSeconds = () => {
    const todayStats = activityStats?.today || { active: 0, totalActive: 0, meeting: 0 };
    const savedTodayActive = Number(todayStats.totalActive) || Number(todayStats.active) || 0;
    return savedTodayActive + (isWorking ? activeSeconds : 0);
  };

  const getTodayTotalMeetingSeconds = () => {
    const todayStats = activityStats?.today || { meeting: 0 };
    const savedTodayMeeting = Number(todayStats.meeting) || 0;
    return savedTodayMeeting + (isWorking ? meetingSeconds : 0);
  };

  const getTodayTotalBreakSeconds = () => {
    const todayStats = activityStats?.today || { break: 0 };
    const savedTodayBreak = Number(todayStats.break) || 0;
    return savedTodayBreak + (isWorking ? breakSeconds : 0);
  };

  const currentActivity = () => {
    if (!activityStats || typeof activityStats !== 'object') {
      const currentActive = isWorking ? activeSeconds : 0;
      const currentMeeting = isWorking ? meetingSeconds : 0;
      const currentIdle = isWorking ? idleSeconds : 0;
      const totalActive = currentActive;
      const productivity = totalActive + currentIdle > 0 ? Math.round((totalActive / (totalActive + currentIdle)) * 100) : 100;
      return { totalActive, idle: currentIdle, productivity, late: 0 };
    }
    const key = activityRange === 'today' ? 'today' : (activityRange === 'week' ? 'week' : 'month');
    const item = activityStats[key] || { active: 0, totalActive: 0, idle: 0, meeting: 0 };

    // Ensure values are numbers
    let active = Number(item.totalActive) || Number(item.active) || 0;
    let meeting = Number(item.meeting) || 0;
    let idle = Number(item.idle) || 0;

    if (isWorking) {
      active += activeSeconds;
      meeting += meetingSeconds;
      idle += idleSeconds;
    }

    // active_seconds already includes meeting_seconds, so total active is simply active
    const totalActive = active;

    const productivity = totalActive + idle > 0 ? Math.round((totalActive / (totalActive + idle)) * 100) : 100;
    const late = Number(activityStats.lateCount) || 0;

    return { totalActive, idle, productivity, late };
  };

  const startTimers = () => {
    if (timerRef.current) {
      console.log('⚠️  [startTimers] Timer already running, skipping...');
      return;
    }

    console.log('🟢 [startTimers] Starting browser-based idle detection...');
    console.log('📋 Activity handler setup with throttle:', ACTIVITY_THROTTLE_MS, 'ms');

    // Activity handler with proper throttling to avoid constant updates
    activityHandlerRef.current = (event: Event) => {
      // ✅ FIX: Ignore fake mousemove events that don't actually change coordinates.
      // This is a known browser/Electron bug where elements can trigger mousemove when static.
      if (event.type === 'mousemove') {
        const mouseEvent = event as MouseEvent;
        const dx = Math.abs(mouseEvent.clientX - lastMousePosRef.current.x);
        const dy = Math.abs(mouseEvent.clientY - lastMousePosRef.current.y);

        // Ignore fake movement or hardware jitter (less than 5 pixels)
        if (dx < 5 && dy < 5) {
          return;
        }
        lastMousePosRef.current = { x: mouseEvent.clientX, y: mouseEvent.clientY };
      }

      const now = Date.now();

      // Only update if enough time has passed (throttle)
      if (now - lastActivityTimeRef.current < ACTIVITY_THROTTLE_MS) {
        return;
      }

      lastActivityTimeRef.current = now;
      lastActivityRef.current = now;

      // Log activity detection (skip mousemove to avoid spam)
      if (event.type !== 'mousemove') {
        console.log(`[Activity Event] Type: ${event.type}, Idle Reset at ${new Date().toLocaleTimeString()}`);
      }

      // If user actively interacts after auto-stop, allow re-start
      if (autoStoppedRef.current) {
        autoStoppedRef.current = false;
        console.log('[Activity] Resetting auto-stop flag after user activity');
      }
    };

    // Attach to document with capture phase for reliable detection
    // ✅ FIX: Removed 'scroll' as it can be triggered programmatically or via CSS
    // animations, causing fake activity. 'wheel' and 'mousemove' already catch scroll intent.
    const events = ['mousemove', 'mousedown', 'keydown', 'keypress', 'click', 'touchstart'];
    let attachedCount = 0;
    events.forEach((evt: string) => {
      try {
        document.addEventListener(evt, activityHandlerRef.current!, {
          capture: true,
          passive: true
        });
        attachedCount++;
      } catch (e) {
        console.error(`Failed to add listener for ${evt}:`, e);
      }
    });

    console.log(`✅ [startTimers] Activity listeners attached: ${attachedCount}/${events.length} events`);

    // Timer that checks idle every 1 second
    timerRef.current = window.setInterval(() => {
      if (!startTimeRef.current) {
        console.warn('[Timer] startTimeRef.current is null, stopping timer');
        stopTimers();
        return;
      }

      const now = Date.now();
      const elapsed = Math.floor((now - startTimeRef.current) / 1000);
      const timeSinceLastActivity = now - lastActivityRef.current;
      const idle = Math.max(0, Math.floor(timeSinceLastActivity / 1000));

      // Debug log to diagnose idle time issues
      if (elapsed % 10 === 0) {
        console.debug(`[DEBUG] now=${now}, lastActivity=${lastActivityRef.current}, timeSinceLastActivity=${timeSinceLastActivity}ms, idle=${idle}s, listeners attached: ${activityHandlerRef.current ? 'YES' : 'NO'}`);
      }

      // Periodic check to ensure listeners are still attached (reconnect if needed)
      if (elapsed % 30 === 0 && activityHandlerRef.current) {
        console.log('[HealthCheck] Verifying activity listeners are still active...');
        // Listeners check: if still connected, they would have detected this setInterval timing
        // If not, we might need to reattach (this is a safeguard)
      }

      // When in meeting mode OR break mode, idle doesn't count
      if (meetingModeRef.current || breakModeRef.current) {
        // Track meeting seconds
        if (meetingModeRef.current) {
          meetingSecondsRef.current += 1;
          setMeetingSeconds(meetingSecondsRef.current);
        }
        // Track break seconds
        if (breakModeRef.current) {
          breakSecondsRef.current += 1;
          setBreakSeconds(breakSecondsRef.current);
        }
        const active = elapsed;
        setActiveSeconds(active);
        setIdleSeconds(0);

        if ((meetingSecondsRef.current + breakSecondsRef.current) % 30 === 0) {
          console.log(`🔵 [Meeting/Break Mode] Active: ${formatHMS(active)}, Meeting: ${formatHMS(meetingSecondsRef.current)}, Break: ${formatHMS(breakSecondsRef.current)}`);
        }
      } else {
        // Normal mode: track active and idle separately
        const active = Math.max(0, elapsed - idle);
        setIdleSeconds(idle);
        setActiveSeconds(active);

        // Log every 5 seconds
        if (elapsed % 5 === 0) {
          console.log(`⏱️  [Idle Check] Active: ${formatHMS(active)} | Idle: ${formatHMS(idle)}/${formatHMS(AUTO_OFF_IDLE_SECONDS)} | TimeSinceActivity: ${Math.floor(timeSinceLastActivity / 1000)}s | SessionElapsed: ${elapsed}s`);
        }

        // Warn 60 seconds before auto-off threshold
        const IDLE_WARNING_SECONDS = AUTO_OFF_IDLE_SECONDS - 60;
        if (idle >= IDLE_WARNING_SECONDS && idle < AUTO_OFF_IDLE_SECONDS) {
          const remainingSeconds = AUTO_OFF_IDLE_SECONDS - idle;
          if (idle % 5 === 0) {
            console.warn(`⏰ [WARNING] Idle for ${idle}s. Auto-stop in ${remainingSeconds}s unless you move!`);
          }

          // Trigger browser native system notification exactly at the start of the warning threshold
          if (idle === IDLE_WARNING_SECONDS && typeof window !== 'undefined' && 'Notification' in window) {
            if (Notification.permission === 'granted') {
              try {
                new Notification('Idle Time Warning', {
                  body: `You have been inactive. You will be automatically marked offline in ${remainingSeconds} seconds.`,
                  icon: '/assets/icon.png'
                });
              } catch (e) {
                console.warn('Failed to display browser notification:', e);
              }
            }
          }
        }

        // AUTO-OFFLINE when idle >= 5 minutes
        if (idle >= AUTO_OFF_IDLE_SECONDS && !autoStoppedRef.current) {
          // ✅ FIX: Read from ref so we always have the current sessionId (not a stale closure)
          const currentSessionId = sessionIdRef.current;
          console.error(`🔴 [AUTO-OFFLINE TRIGGERED] Idle: ${idle}s >= ${AUTO_OFF_IDLE_SECONDS}s - STOPPING SESSION! sessionId=${currentSessionId}`);
          autoStoppedRef.current = true;

          (async () => {
            let stopSucceeded = false;
            try {
              if (currentSessionId) {
                console.log(`📤 Sending stop request, Idle: ${idle}s, Active: ${active}s, sessionId: ${currentSessionId}`);
                await http.stopSession(currentSessionId, {
                  activeSeconds: active,
                  idleSeconds: idle,
                  meetingSeconds: meetingSecondsRef.current,
                  meetingCount: meetingCountRef.current,
                  breakSeconds: breakSecondsRef.current,
                  breakCount: breakCountRef.current
                });
                console.log('✅ Session stopped successfully on server');
                stopSucceeded = true;
              } else {
                // No session to stop — still mark as stopped so UI clears
                console.warn('⚠️ [AUTO-OFFLINE] No sessionId found in ref — clearing UI state only');
                stopSucceeded = true;
              }
            } catch (e) {
              console.error('❌ Error stopping session:', e);
              stopSucceeded = false;
              // Reset the auto-stop flag so we can try again on next tick
              autoStoppedRef.current = false;
            } finally {
              if (stopSucceeded) {
                stopTimers();
                localStorage.removeItem('sessionId');
                localStorage.removeItem('meetingMode');
                sessionIdRef.current = null;
                setIsWorking(false);
                setSessionId(null);
                startTimeRef.current = null;
                setIsMeetingMode(false);
                meetingModeRef.current = false;
                // ✅ BUG FIX: Also reset break mode ref on auto-stop
                setIsBreakMode(false);
                breakModeRef.current = false;
                // ✅ BUG FIX #8: set state (not ref) so banner actually re-renders
                setWasAutoStopped(true);
              }
            }
          })();
        }
      }
    }, 1000) as unknown as number;

    console.log('✅ [startTimers] Interval timer started (checking every 1 second)');
  };

  const stopTimers = () => {
    console.log('🔴 [stopTimers] Stopping browser timers...');

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
      console.log('✅ Interval cleared');
    }

    if (activityHandlerRef.current) {
      const events = ['mousemove', 'mousedown', 'keydown', 'keypress', 'click', 'touchstart'];
      events.forEach((evt: string) => {
        try {
          document.removeEventListener(evt, activityHandlerRef.current!, true);
        } catch (e) {
          console.error(`Failed to remove listener for ${evt}:`, e);
        }
      });
      activityHandlerRef.current = null;
      lastActivityTimeRef.current = 0;
      console.log('✅ Activity listeners removed');
    }
  };

  /* ================= LEAVES ================= */
  const fetchLeaves = async () => {
    if (!user) return;
    // ✅ BUG FIX #16: Set loading state while refreshing leave data
    setLeavesLoading(true);
    try {
      const data = await http.getMyLeaves();
      // ✅ BUG FIX #17: Normalize snake_case backend keys to camelCase for the template
      const normalized = Array.isArray(data)
        ? data.map((r: any) => ({
          id: String(r.id),
          userId: String(r.user_id || r.userId),
          userName: r.name || r.userName || '',
          fromDate: r.from_date || r.fromDate || '',
          toDate: r.to_date || r.toDate || '',
          type: r.type || '',
          reason: r.reason || '',
          status: r.status || '',
          appliedOn: r.applied_on || r.appliedOn || '',
        }))
        : [];
      setMyLeaves(normalized);
    } catch (e) {
      console.error('Failed to fetch leaves', e);
    } finally {
      setLeavesLoading(false);
    }
  };

  const handleApplyLeave = async (data: any) => {
    if (!user) return;
    await http.applyLeave(data); // ← Changed
    await fetchLeaves();
  };

  /* ================= EFFECTS ================= */
  // Request notification permission on component mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          console.log(`[Notification] Permission requested: ${permission}`);
        }).catch(err => {
          console.warn('[Notification] Failed to request permission:', err);
        });
      }
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchLeaves();

    // Fetch activity stats (today/week/month) for this user
    // ✅ BUG FIX #13: Track loading and error states for the activity card
    setStatsLoading(true);
    setStatsError(null);
    (async () => {
      try {
        const s: any = await http.getEmployeeStats(user.id);
        setActivityStats(s);
      } catch (e) {
        console.error('Failed to fetch employee stats', e);
        setStatsError('Failed to load activity data. Please refresh.');
      } finally {
        setStatsLoading(false);
      }
    })();

    // Restore working state from localStorage only (manual user control)
    // Do NOT auto-restore from server - only use what the user explicitly set
    const storedSessionId = localStorage.getItem('sessionId');
    const storedMeetingMode = localStorage.getItem('meetingMode');

    // ✅ VALIDATION: Ensure stored session ID is valid before using
    if (storedSessionId) {
      const sessionIdStr = String(storedSessionId).trim();

      if (sessionIdStr &&
        sessionIdStr !== 'null' &&
        sessionIdStr !== '' &&
        /^\d+$/.test(sessionIdStr)) {  // Must be numeric ID

        // Verify session still exists on server
        (async () => {
          try {
            const activeSession = await http.getActiveSession();
            if (activeSession && activeSession.id && String(activeSession.id) === String(sessionIdStr)) {
              // Session exists, safe to restore
              sessionIdRef.current = sessionIdStr;
              setSessionId(sessionIdStr);
              setIsWorking(true);

              // Restore meeting mode state if it was set
              const isM = storedMeetingMode === 'true';
              setIsMeetingMode(isM);
              meetingModeRef.current = isM;

              const storedBreakMode = localStorage.getItem('breakMode');
              const isB = storedBreakMode === 'true';
              setIsBreakMode(isB);
              breakModeRef.current = isB;

              if (isElectronRef.current) {
                const electron = (window as any).electron;
                (async () => {
                  try {
                    await electron.startTracking();
                    electron.onTrackingUpdate((data: any) => {
                      setActiveSeconds(data.activeSeconds || 0);
                      setIdleSeconds(data.idleSeconds || 0);
                      setMeetingSeconds(data.meetingSeconds || 0);
                      setIsMeetingMode(data.isMeetingMode || false);
                      meetingModeRef.current = data.isMeetingMode || false;
                      meetingSecondsRef.current = data.meetingSeconds || 0;
                      meetingCountRef.current = data.meetingCount || 0;
                      setIsBreakMode(data.isBreakMode || false);
                      breakModeRef.current = data.isBreakMode || false;
                      setBreakSeconds(data.breakSeconds || 0);
                      breakSecondsRef.current = data.breakSeconds || 0;
                      breakCountRef.current = data.breakCount || 0;
                    });
                    if (isM) {
                      await electron.setMeetingMode(true);
                    }
                    if (isB) {
                      await electron.setBreakMode(true);
                    }

                    // Also need to listen for auto stop when restoring
                    electron.onAutoStop(() => {
                      console.log('✅ Auto-stopped by Electron (restore flow)');
                      stopTrackingInternal(true);
                    });
                  } catch (e) {
                    console.error('Failed to restore Electron tracking', e);
                    // Fallback to browser mode
                    startTimeRef.current = Date.now();
                    lastActivityRef.current = Date.now();
                    startTimers();
                  }
                })();
              } else {
                // Browser mode: use browser-level idle detection
                // ✅ FIX: Always start from NOW (00:00:00) when restoring a session
                // Do NOT use res.startTime from server as that would show elapsed time from original session start
                startTimeRef.current = Date.now();
                lastActivityRef.current = Date.now();
                setIdleSeconds(0);
                setActiveSeconds(0);
                meetingSecondsRef.current = 0;
                setMeetingSeconds(0);
                startTimers();
              }
            } else {
              // Session doesn't exist on server, clear invalid state
              console.warn('Stored session does not exist on server, clearing');
              localStorage.removeItem('sessionId');
              localStorage.removeItem('meetingMode');
            }
          } catch (err) {
            // If check fails, clear stored session to be safe
            console.warn('Could not verify stored session:', err);
            localStorage.removeItem('sessionId');
            localStorage.removeItem('meetingMode');
          }
        })();
      }
    }
  }, [user]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimers();
      // Cleanup Electron listeners if needed
      if (isElectronRef.current) {
        const electron = (window as any).electron;
        try {
          electron.removeTrackingListener();
        } catch (e) {
          // Listener may not exist
        }
      }
    };
  }, []);

  /* ================= TAB VISIBILITY TRACKING ================= */
  // ✅ FIX: Do NOT reset the idle timer when the tab is hidden.
  // Previously, hiding the tab reset lastActivityRef to NOW, which prevented
  // idle time from ever reaching 5 minutes (it kept resetting on every tab switch).
  // Now: idle continues accumulating while tab is hidden.
  // When the tab becomes visible again we reset, treating "user returned" as activity.
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = !document.hidden;
      isPageVisibleRef.current = isVisible;

      if (!isWorking || !startTimeRef.current) return;

      if (isVisible) {
        const timeSinceLastActivity = Date.now() - lastActivityRef.current;

        // If they were gone for longer than the auto-off threshold, do NOT reset the timer.
        // Let the interval catch it and log them out correctly.
        if (timeSinceLastActivity < AUTO_OFF_IDLE_SECONDS * 1000) {
          // Tab is visible again → user came back, reset idle timer
          lastActivityRef.current = Date.now();
          console.log('[Visibility] Tab visible again — idle timer reset.');
        } else {
          console.log('🔴 [Visibility] Tab visible again after 5+ mins of idle. Waiting for interval to trigger auto-logout.');
        }
      }
      // Tab hidden → do nothing; idle time keeps accumulating naturally
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isWorking]);

  /* ================= BEFOREUNLOAD - Stop session when user closes/refreshes ================= */
  // ✅ useEffect dependency fix: Use refs for metrics instead of state
  // This prevents the listener from being re-attached every second
  const activeSecondsRef = React.useRef<number>(0);
  const idleSecondsRef = React.useRef<number>(0);

  // Keep refs in sync with state
  React.useEffect(() => {
    activeSecondsRef.current = activeSeconds;
  }, [activeSeconds]);

  React.useEffect(() => {
    idleSecondsRef.current = idleSeconds;
  }, [idleSeconds]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isWorking || !sessionId) return;

      console.log('⚠️  [beforeunload] User is closing/refreshing page while session is active');

      // ✅ FIX: Use refs to capture current values, not stale closure values
      const metrics = {
        activeSeconds: activeSecondsRef.current,
        idleSeconds: idleSecondsRef.current,
        meetingSeconds: meetingSecondsRef.current,
        meetingCount: meetingCountRef.current,
        breakSeconds: breakSecondsRef.current,
        breakCount: breakCountRef.current
      };

      // Try to send stop request with keepalive flag
      try {
        // ✅ FIX: Validate token exists before using it
        const token = localStorage.getItem('token');
        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        };
        if (token) {
          const trimmedToken = String(token).trim();
          if (trimmedToken) {
            headers['Authorization'] = `Bearer ${trimmedToken}`;
          }
        }

        const apiBase = (import.meta.env.VITE_API_URL as string || 'http://localhost:3001').replace(/\/+$/, '');
        fetch(`${apiBase}/sessions/${sessionId}/stop`, {
          method: 'POST',
          headers,
          body: JSON.stringify(metrics),
          keepalive: true // Important: allows request to complete even if page unloads
        }).catch(e => console.warn('Failed to stop session on unload:', e));
      } catch (e) {
        console.warn('Error in beforeunload handler:', e);
      }

      // Optional: Show confirmation dialog
      event.preventDefault();
      event.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isWorking, sessionId]);  // ✅ REMOVED: activeSeconds, idleSeconds (use refs instead)

  /* ================= SESSION ================= */
  const handleToggle = async () => {
    if (!user) return;

    if (!isWorking) {
      // Start session
      console.log(`🟢 [START SESSION] User: ${user.name}, Electron: ${isElectronRef.current}`);
      let sessionStartTime: number | null = null;

      try {
        const res: any = await http.startSession(user.id);
        const sid = res?.id ?? res?.sessionId ?? res;
        sessionIdRef.current = String(sid);
        setSessionId(String(sid));
        setIsWorking(true);
        localStorage.setItem('sessionId', String(sid));

        // Capture session start time for browser-mode idle detection
        sessionStartTime = Date.now();
      } catch (err: any) {
        // Handle case where user already has an active session
        if (err?.status === 400 && err?.body?.sessionId) {
          console.log(`⚠️ [ACTIVE SESSION EXISTS] Reusing session: ${err.body.sessionId}`);
          sessionIdRef.current = String(err.body.sessionId);
          setSessionId(String(err.body.sessionId));
          setIsWorking(true);
          localStorage.setItem('sessionId', String(err.body.sessionId));
        } else {
          // Other errors should be shown to user
          console.error('❌ Failed to start session:', err);
          alert(`Failed to start session: ${err?.message || 'Unknown error'}`);
          return;
        }
      }

      // If using Electron, use system-wide idle detection
      if (isElectronRef.current) {
        const electron = (window as any).electron;

        // Start system-wide tracking in Electron main process
        await electron.startTracking();

        // Listen for tracking updates from Electron (system-wide idle detection)
        electron.onTrackingUpdate((data: any) => {
          setActiveSeconds(data.activeSeconds || 0);
          setIdleSeconds(data.idleSeconds || 0);
          setMeetingSeconds(data.meetingSeconds || 0);
          setIsMeetingMode(data.isMeetingMode || false);
          meetingModeRef.current = data.isMeetingMode || false;
          meetingSecondsRef.current = data.meetingSeconds || 0;
          meetingCountRef.current = data.meetingCount || 0;
          setIsBreakMode(data.isBreakMode || false);
          breakModeRef.current = data.isBreakMode || false;
          setBreakSeconds(data.breakSeconds || 0);
          breakSecondsRef.current = data.breakSeconds || 0;
          breakCountRef.current = data.breakCount || 0;
        });

        // Listen for auto-stop event
        electron.onAutoStop(() => {
          console.log('✅ Auto-stopped by Electron (5 min idle)');
          stopTrackingInternal(true); // ✅ BUG FIX: pass true to show the auto-offline banner
        });
      } else {
        // Browser-only fallback: use browser-level idle detection
        startTimeRef.current = sessionStartTime ? sessionStartTime : Date.now();
        autoStoppedRef.current = false;
        setWasAutoStopped(false); // ✅ BUG FIX #8: clear banner when user starts a new session
        setIdleSeconds(0);
        setActiveSeconds(0);
        // Reset activity times to session start
        const sessionStartTimeVal = startTimeRef.current!;
        lastActivityRef.current = sessionStartTimeVal;
        lastActivityTimeRef.current = sessionStartTimeVal;
        startTimers();
      }

    } else {
      // Stop tracking
      stopTrackingInternal(false);
    }
  };

  const stopTrackingInternal = async (isAutoStop: boolean = false) => {
    // ✅ BUG FIX #4: Use refs (always current) instead of stale React state for metrics
    const metrics = {
      activeSeconds: activeSecondsRef.current,
      idleSeconds: idleSecondsRef.current,
      meetingSeconds: meetingSecondsRef.current,
      meetingCount: meetingCountRef.current,
      breakSeconds: breakSecondsRef.current,
      breakCount: breakCountRef.current
    };

    // ✅ FIX: Validate sessionId is a real value (not null, 'null', or empty string)
    const currentSessionId = sessionIdRef.current;
    let sessionStopped = false;

    if (currentSessionId && currentSessionId !== 'null' && typeof currentSessionId === 'string' && currentSessionId.trim().length > 0) {
      try {
        if (isElectronRef.current) {
          const electron = (window as any).electron;
          // Stop Electron tracking and get final metrics
          const finalMetrics = await electron.stopTracking();
          setActiveSeconds(finalMetrics.activeSeconds || 0);
          setIdleSeconds(finalMetrics.idleSeconds || 0);
          setMeetingSeconds(finalMetrics.meetingSeconds || 0);
          // Use the final metrics from Electron (add break metrics from refs)
          finalMetrics.breakSeconds = breakSecondsRef.current;
          finalMetrics.breakCount = breakCountRef.current;
          await http.stopSession(currentSessionId, finalMetrics);
          sessionStopped = true;
        } else {
          // Browser mode
          stopTimers();
          await http.stopSession(currentSessionId, metrics);
          sessionStopped = true;
        }
      } catch (err: any) {
        if (err?.status === 404 || err?.response?.status === 404) {
          console.warn('Session not found on server (may have expired)', currentSessionId);
          sessionStopped = true; // Consider it "handled" since session doesn't exist
        } else {
          console.error('Error stopping session:', err);
        }
      }
    } else {
      // No session to stop - just clear state
      stopTimers();
      sessionStopped = true;
    }

    // Clear session state immediately
    setIsWorking(false);
    sessionIdRef.current = null;
    setSessionId(null);
    localStorage.removeItem('sessionId');
    localStorage.removeItem('meetingMode');
    localStorage.removeItem('breakMode');
    setIsMeetingMode(false);
    setIsBreakMode(false);

    // Reset local metrics
    startTimeRef.current = null;
    meetingSecondsRef.current = 0;
    meetingCountRef.current = 0;
    breakSecondsRef.current = 0;
    breakCountRef.current = 0;
    autoStoppedRef.current = false;
    setActiveSeconds(0);
    setIdleSeconds(0);
    setMeetingSeconds(0);
    setBreakSeconds(0);

    // ✅ BUG FIX: Fetch updated stats after session is stopped to show the recorded time
    // This is critical for the "offline mid-day, come back online" scenario
    if (sessionStopped && user) {
      try {
        const s: any = await http.getEmployeeStats(user.id);
        setActivityStats(s);
        console.log('✅ Stats refreshed after session stop');
      } catch (e) {
        console.error('Failed to refresh stats after stopping session', e);
      }
    }

    // ✅ Show the auto-offline banner if this was triggered automatically
    if (isAutoStop) {
      setWasAutoStopped(true);
    }
  };

  /* ================= RENDER ================= */
  return (
    <Layout title="My Dashboard">

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* LEFT COLUMN */}
        <div className="lg:col-span-2 space-y-6">

          {/* STATUS CARD */}
          <div className="glass rounded-2xl p-6 sm:p-8 flex flex-col items-center shadow-sm relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-transparent pointer-events-none rounded-2xl"></div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 mb-2 relative z-10 tracking-tight">
              {isWorking ? 'You are Online' : 'You are Offline'}
            </h2>
            <p className={`text-sm sm:text-base font-medium relative z-10 ${isWorking ? 'text-green-600' : 'text-slate-500'}`}>
              {isWorking
                ? '● System is actively tracking work hours'
                : '○ Click to start working'}
            </p>

            {/* TOGGLE BUTTON */}
            <div
              onClick={handleToggle}
              className={`mt-8 w-56 sm:w-64 h-20 sm:h-24 rounded-full cursor-pointer transition-all duration-300 flex items-center p-2 shadow-inner relative z-10
                ${isWorking ? 'bg-gradient-to-r from-green-400 to-green-500 shadow-green-500/20' : 'bg-slate-200 shadow-slate-300/30'}`}
            >
              <div
                className={`bg-white w-16 h-16 sm:w-20 sm:h-20 rounded-full shadow-md transform transition-transform duration-500 ease-out flex items-center justify-center
                  ${isWorking ? 'translate-x-36 sm:translate-x-40' : 'translate-x-0'}`}
              >
                {isWorking ? (
                  <svg className="w-8 h-8 sm:w-10 sm:h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                ) : (
                  <svg className="w-8 h-8 sm:w-10 sm:h-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                )}
              </div>
            </div>

            {/* Session Timers */}
            <div className="mt-8 w-full grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 relative z-10">
              <div className="bg-white/80 backdrop-blur-sm p-4 rounded-xl shadow-sm border border-green-100 text-center transition-all hover:shadow-md hover:scale-[1.02]">
                <div className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase tracking-wider">Active</div>
                <div className="text-xl sm:text-2xl font-black text-green-600 mt-1">{formatHMS(activeSeconds)}</div>
              </div>
              <div className="bg-white/80 backdrop-blur-sm p-4 rounded-xl shadow-sm border border-yellow-100 text-center transition-all hover:shadow-md hover:scale-[1.02]">
                <div className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase tracking-wider">Idle</div>
                <div className="text-xl sm:text-2xl font-black text-yellow-600 mt-1">{formatHMS(idleSeconds)}</div>
              </div>
              <div className="bg-white/80 backdrop-blur-sm p-4 rounded-xl shadow-sm border border-purple-100 text-center transition-all hover:shadow-md hover:scale-[1.02]">
                <div className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase tracking-wider">Meeting</div>
                <div className="text-xl sm:text-2xl font-black text-purple-600 mt-1">{formatHMS(getTodayTotalMeetingSeconds())}</div>
              </div>

              <div className="bg-white/80 backdrop-blur-sm p-4 rounded-xl shadow-sm border border-blue-100 text-center transition-all hover:shadow-md hover:scale-[1.02]">
                <div className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase tracking-wider">Today's Active</div>
                <div className="text-xl sm:text-2xl font-black text-blue-600 mt-1">{formatHMS(getTodayTotalActiveSeconds())}</div>
              </div>
            </div>

            {/* ⚠️ AUTO-OFFLINE WARNING - Show when idle is approaching threshold (not in meeting or break mode) */}
            {isWorking && !isMeetingMode && idleSeconds >= (AUTO_OFF_IDLE_SECONDS - 60) && idleSeconds < AUTO_OFF_IDLE_SECONDS && (
              <div className="mt-6 w-full">
                <div className="p-4 bg-red-50 border-2 border-red-300 rounded-lg text-red-800">
                  <div className="font-bold text-lg">⚠️ AUTOMATIC OFFLINE WARNING</div>
                  <div className="text-sm mt-2">
                    You've been idle for <span className="font-bold">{formatHMS(idleSeconds)}</span>.
                    <br />
                    You will be automatically marked offline in <span className="font-bold text-red-600">{formatHMS(AUTO_OFF_IDLE_SECONDS - idleSeconds)}</span>
                  </div>
                  <div className="text-xs mt-3 text-red-700">
                    💡 Move your mouse or press a key to stay online, or click "Enter Meeting Mode" if needed.
                  </div>
                  <div className="mt-4 w-full h-2 bg-red-200 rounded-full overflow-hidden">
                    <div
                      className="h-2 bg-red-600 transition-all"
                      style={{ width: `${Math.min(100, (idleSeconds / AUTO_OFF_IDLE_SECONDS) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ✅ BUG FIX #8: Use wasAutoStopped state (not ref) so React re-renders the banner */}
            {!isWorking && wasAutoStopped && (
              <div className="mt-6 w-full">
                <div className="p-4 bg-green-50 border-2 border-green-300 rounded-lg text-green-800">
                  <div className="font-bold text-lg">✅ SESSION CLOSED - Auto-Offline Triggered</div>
                  <div className="text-sm mt-2">
                    You were automatically marked offline after 5 minutes of inactivity.
                    <br />
                    Active Time: <span className="font-bold">{formatHMS(activeSeconds)}</span> |
                    Idle Time: <span className="font-bold">{formatHMS(idleSeconds)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Meeting Mode Controls */}
            <div className="mt-6 w-full text-center">
              {isMeetingMode && (
                <div className="mb-3 p-3 bg-purple-50 rounded border border-purple-100 text-purple-700 font-semibold">Meeting Mode Active — Idle Not Tracked</div>
              )}

              <div className="flex flex-wrap justify-center gap-3">
                <button
                  onClick={async () => {
                    if (!isWorking) {
                      await handleToggle();
                    }
                    const next = !isMeetingMode;
                    console.log(`🔵 [Meeting Mode Toggle] ${next ? 'ENTERING' : 'EXITING'} meeting mode`);
                    setIsMeetingMode(next);
                    meetingModeRef.current = next;
                    autoStoppedRef.current = false;
                    localStorage.setItem('meetingMode', next ? 'true' : 'false');
                    if (isElectronRef.current) {
                      const electron = (window as any).electron;
                      await electron.setMeetingMode(next);
                      console.log(`✅ [Meeting Mode] Electron notified: ${next ? 'ON' : 'OFF'}`);
                    }
                    if (next) {
                      meetingSecondsRef.current = 0;
                      meetingCountRef.current = (meetingCountRef.current || 0) + 1;
                      setMeetingSeconds(0);
                      lastActivityRef.current = Date.now();
                      console.log(`✅ [Meeting Mode] ENTERED - Idle timer reset.`);
                    } else {
                      lastActivityRef.current = Date.now();
                      console.log(`✅ [Meeting Mode] EXITED - Idle timer reset.`);
                    }
                  }}
                  className={`px-6 py-3 rounded-md font-medium ${isMeetingMode ? 'bg-purple-500 text-white' : 'bg-purple-100 text-purple-700'}`}
                >
                  {isMeetingMode ? 'Exit Meeting' : 'Enter Meeting'}
                </button>

              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="flex flex-col gap-6 w-full">

          {/* ACTIVITY CARD */}
          <div className="glass rounded-2xl shadow-sm p-5 sm:p-6 mb-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3 sm:gap-0">
              <h4 className="font-bold text-slate-800 text-lg">Your Activity</h4>
              <div className="flex items-center space-x-1 sm:space-x-2 bg-slate-100 p-1 rounded-lg">
                {(['today', 'week', 'month'] as const).map(r => (
                  <button
                    key={r}
                    onClick={() => setActivityRange(r)}
                    className={`text-xs sm:text-sm px-3 py-1.5 rounded-md font-medium transition-colors ${activityRange === r ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >{r === 'today' ? 'Today' : r === 'week' ? 'Week' : 'Month'}</button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="px-2">
                {/* ✅ BUG FIX #13: Show loading/error states for activity stats */}
                {statsLoading ? (
                  <div className="flex items-center justify-center py-6 text-slate-400">
                    <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Loading activity...
                  </div>
                ) : statsError ? (
                  <div className="py-4 text-center text-sm text-red-500">{statsError}</div>
                ) : (
                  (() => {
                    const { totalActive, idle, productivity, late } = currentActivity();
                    return (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-sm text-gray-500">Total Active Time</div>
                          <div className="text-lg font-bold text-green-600">{formatHours(totalActive)}</div>
                        </div>
                        <div className="h-2 bg-green-100 rounded-full mb-3"><div style={{ width: '100%' }} className="h-2 bg-green-600 rounded-full" /></div>

                        <div className="flex items-center justify-between mb-1">
                          <div className="text-sm text-gray-500">Idle Time</div>
                          <div className="text-lg font-bold text-yellow-600">{formatHours(idle)}</div>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full mb-3"><div style={{ width: '100%' }} className="h-2 bg-yellow-300 rounded-full" /></div>

                        {activityRange === 'month' && (
                          <div className="mb-3">
                            <div className="text-sm text-gray-500">Late Arrivals</div>
                            <div className="flex items-center justify-between">
                              <div className="text-sm">{late} / 6 allowed</div>
                              <div className="w-3/4 h-2 bg-blue-100 rounded-full"><div style={{ width: `${Math.min(100, (late / 6) * 100)}%` }} className="h-2 bg-blue-500 rounded-full" /></div>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <div className="text-sm text-gray-500">Productivity Score</div>
                          <div className="text-lg font-bold text-green-600">{productivity}%</div>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full mt-2"><div style={{ width: `${productivity}%` }} className="h-2 bg-green-500 rounded-full" /></div>
                      </div>
                    );
                  })()
                )}
              </div>
            </div>
          </div>

          {/* APPLY LEAVE */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl shadow-md p-5 sm:p-6 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 hover:shadow-lg transition-all relative overflow-hidden">
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-white opacity-10 rounded-full blur-xl pointer-events-none"></div>
            <div className="relative z-10">
              <h3 className="font-bold text-lg tracking-tight">Leave Application</h3>
              <p className="text-blue-100 text-sm font-medium mt-1">Need time off? Submit a request.</p>
            </div>
            <Button
              variant="secondary"
              onClick={() => setIsLeaveModalOpen(true)}
              className="text-blue-700 border-none hover:bg-slate-50 shadow-sm font-semibold w-full sm:w-auto relative z-10"
            >
              Apply Now
            </Button>
          </div>

          {/* RECENT LEAVES */}
          {/* ✅ BUG FIX #16: Show loading spinner while leaves are refreshing */}
          {leavesLoading ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex items-center gap-2 text-gray-400 text-sm">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Refreshing requests...
            </div>
          ) : myLeaves.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h4 className="font-bold text-gray-800 mb-3 text-sm">Recent Requests</h4>
              <div className="space-y-3">
                {myLeaves.slice(0, 3).map(leave => (
                  <div
                    key={leave.id}
                    className="flex justify-between items-center text-sm border-b border-gray-50 pb-2 last:border-0"
                  >
                    <div>
                      <div className="font-medium text-gray-700">{leave.type}</div>
                      <div className="text-xs text-gray-500">
                        {leave.fromDate === leave.toDate
                          ? leave.fromDate
                          : `${leave.fromDate} to ${leave.toDate}`}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-bold capitalize
                        ${leave.status === LeaveStatus.APPROVED
                          ? 'bg-green-100 text-green-700'
                          : leave.status === LeaveStatus.REJECTED
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'}`}
                    >
                      {leave.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CALENDAR */}
          {user && <AttendanceCalendar userId={user.id} />}
        </div>
      </div>

      <LeaveRequestModal
        isOpen={isLeaveModalOpen}
        onClose={() => setIsLeaveModalOpen(false)}
        onSubmit={handleApplyLeave}
      />
    </Layout>
  );
};