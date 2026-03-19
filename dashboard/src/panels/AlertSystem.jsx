import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AlertTriangle, X, Bell, Info, AlertOctagon } from 'lucide-react';
import { alertColors } from '../utils/colors';

const SEVERITY_ICONS = {
  info: Info,
  warning: AlertTriangle,
  critical: AlertOctagon,
};

const SEVERITY_MAP = {
  info: 'INFO',
  warning: 'WARNING',
  critical: 'CRITICAL',
};

const AUTO_DISMISS_MS = {
  info: 5000,
  warning: 8000,
  critical: 0, // critical alerts require manual dismissal
};

function AlertBanner({ alert, onDismiss }) {
  const severity = alert.severity || 'info';
  const severityKey = SEVERITY_MAP[severity] || 'INFO';
  const style = alertColors[severityKey] || alertColors.INFO;
  const IconComponent = SEVERITY_ICONS[severity] || Info;
  const isCritical = severity === 'critical';

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${style.bg} ${style.border} ${
        isCritical ? 'animate-pulse' : ''
      } backdrop-blur-sm transition-all duration-300`}
    >
      <IconComponent
        className={`w-5 h-5 flex-shrink-0 ${style.text}`}
        style={{ filter: `drop-shadow(0 0 6px ${style.icon}60)` }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span
            className={`text-[10px] font-orbitron font-bold tracking-widest ${style.text}`}
          >
            {(alert.type || 'SYSTEM').toUpperCase()}
          </span>
          <span className="text-[9px] font-mono-tech text-neutral-500">
            {severity.toUpperCase()}
          </span>
        </div>
        <p className={`text-sm font-rajdhani ${style.text} leading-tight`}>
          {alert.message || 'Unknown alert'}
        </p>
      </div>
      <button
        onClick={() => onDismiss(alert._id)}
        className="flex-shrink-0 p-1 rounded hover:bg-neutral-700/50 transition-colors"
        aria-label="Dismiss alert"
      >
        <X className="w-4 h-4 text-neutral-500 hover:text-neutral-300" />
      </button>
    </div>
  );
}

export default function AlertSystem({ data }) {
  const [activeAlerts, setActiveAlerts] = useState([]);
  const idCounter = useRef(0);
  const seenKeys = useRef(new Set());

  // Process incoming alerts from data.
  useEffect(() => {
    const incoming = data?.alerts;
    if (!Array.isArray(incoming) || incoming.length === 0) return;

    const newAlerts = [];
    for (const alert of incoming) {
      // Deduplicate by type + message.
      const key = `${alert.type || ''}:${alert.message || ''}`;
      if (seenKeys.current.has(key)) continue;
      seenKeys.current.add(key);

      const id = ++idCounter.current;
      newAlerts.push({ ...alert, _id: id, _key: key, _ts: Date.now() });

      // Schedule auto-dismiss for non-critical alerts.
      const dismissMs = AUTO_DISMISS_MS[alert.severity] || 5000;
      if (dismissMs > 0) {
        setTimeout(() => {
          setActiveAlerts((prev) => prev.filter((a) => a._id !== id));
          seenKeys.current.delete(key);
        }, dismissMs);
      }
    }

    if (newAlerts.length > 0) {
      setActiveAlerts((prev) => [...newAlerts, ...prev].slice(0, 10));
    }
  }, [data?.alerts]);

  const handleDismiss = useCallback((id) => {
    setActiveAlerts((prev) => {
      const alert = prev.find((a) => a._id === id);
      if (alert) {
        seenKeys.current.delete(alert._key);
      }
      return prev.filter((a) => a._id !== id);
    });
  }, []);

  const clearAll = useCallback(() => {
    setActiveAlerts([]);
    seenKeys.current.clear();
  }, []);

  if (activeAlerts.length === 0) {
    return (
      <div className="panel-carbon p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Bell className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-mono-tech text-neutral-500 tracking-widest">
            ALERTS
          </span>
        </div>
        <div className="flex items-center justify-center py-6 text-neutral-600">
          <div className="text-center">
            <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs font-mono-tech">No active alerts</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="panel-carbon p-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Bell className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-mono-tech text-neutral-500 tracking-widest">
            ALERTS
          </span>
          <span className="ml-1 px-1.5 py-0.5 bg-red-900/50 border border-red-600/40 rounded text-[10px] font-mono-tech text-red-400">
            {activeAlerts.length}
          </span>
        </div>
        <button
          onClick={clearAll}
          className="text-[10px] font-mono-tech text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          CLEAR ALL
        </button>
      </div>

      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {activeAlerts.map((alert) => (
          <AlertBanner key={alert._id} alert={alert} onDismiss={handleDismiss} />
        ))}
      </div>
    </div>
  );
}
