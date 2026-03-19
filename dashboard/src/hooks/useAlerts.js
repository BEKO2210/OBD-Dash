import { useState, useCallback, useRef, useEffect } from 'react';

const AUTO_DISMISS = {
  INFO: 3000,
  WARNING: 10000,
  CRITICAL: null, // never auto-dismiss
};

let alertIdCounter = 0;

export default function useAlerts() {
  const [alerts, setAlerts] = useState([]);
  const timersRef = useRef({});

  const addAlert = useCallback((level, message, source = '') => {
    const id = ++alertIdCounter;
    const alert = {
      id,
      level: level || 'INFO',
      message,
      source,
      timestamp: Date.now(),
    };

    setAlerts((prev) => {
      // Deduplicate: don't add if same message + level already active
      const exists = prev.some(
        (a) => a.message === message && a.level === level
      );
      if (exists) return prev;
      return [...prev, alert];
    });

    const dismissTime = AUTO_DISMISS[level];
    if (dismissTime) {
      timersRef.current[id] = setTimeout(() => {
        setAlerts((prev) => prev.filter((a) => a.id !== id));
        delete timersRef.current[id];
      }, dismissTime);
    }

    return id;
  }, []);

  const dismissAlert = useCallback((id) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
  }, []);

  const processDataAlerts = useCallback(
    (data) => {
      if (!data) return;

      // Process alerts array from telemetry data
      if (Array.isArray(data.alerts)) {
        data.alerts.forEach((a) => {
          addAlert(a.level || 'WARNING', a.message || a.text, a.source || '');
        });
      }

      // Auto-generate alerts from critical values
      if (data.coolant_temp != null && data.coolant_temp > 115) {
        addAlert('CRITICAL', `Coolant temp critical: ${Math.round(data.coolant_temp)}°C`, 'thermal');
      } else if (data.coolant_temp != null && data.coolant_temp > 105) {
        addAlert('WARNING', `Coolant temp high: ${Math.round(data.coolant_temp)}°C`, 'thermal');
      }

      if (data.oil_temp != null && data.oil_temp > 140) {
        addAlert('CRITICAL', `Oil temp critical: ${Math.round(data.oil_temp)}°C`, 'thermal');
      }

      if (data.oil_pressure != null && data.oil_pressure < 1.0 && data.rpm > 1000) {
        addAlert('CRITICAL', 'Low oil pressure!', 'engine');
      }
    },
    [addAlert]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach(clearTimeout);
    };
  }, []);

  return { alerts, addAlert, dismissAlert, processDataAlerts };
}
