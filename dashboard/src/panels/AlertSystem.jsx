import React from 'react';
import { X, AlertTriangle, AlertOctagon, Info } from 'lucide-react';
import { alertColors } from '../utils/colors';

function AlertIcon({ level }) {
  if (level === 'CRITICAL') return <AlertOctagon className="w-5 h-5 flex-shrink-0" />;
  if (level === 'WARNING') return <AlertTriangle className="w-4 h-4 flex-shrink-0" />;
  return <Info className="w-4 h-4 flex-shrink-0" />;
}

function CriticalOverlay({ alert, onDismiss }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-auto">
      <div className="absolute inset-0 bg-red-900/20 critical-flash" />
      <div className="relative panel-carbon border-2 border-red-500 glow-red p-8 max-w-md text-center critical-flash">
        <button
          onClick={() => onDismiss(alert.id)}
          className="absolute top-3 right-3 text-red-400 hover:text-red-300 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        <AlertOctagon className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <div className="font-orbitron text-xl font-bold text-red-400 text-glow-red mb-2 tracking-wider">
          CRITICAL
        </div>
        <div className="font-rajdhani text-lg text-red-200">
          {alert.message}
        </div>
        {alert.source && (
          <div className="font-mono-tech text-xs text-red-400/60 mt-2 uppercase tracking-wider">
            {alert.source}
          </div>
        )}
      </div>
    </div>
  );
}

function WarningToast({ alert, onDismiss }) {
  const style = alertColors[alert.level] || alertColors.WARNING;
  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-lg border backdrop-blur-sm ${style.bg} ${style.border}`}
      style={{ animation: 'fadeIn 0.3s ease-out' }}
    >
      <div className={style.text}>
        <AlertIcon level={alert.level} />
      </div>
      <div className="flex-1 min-w-0">
        <div className={`font-rajdhani text-sm font-semibold ${style.text}`}>
          {alert.message}
        </div>
        {alert.source && (
          <div className="font-mono-tech text-[10px] text-neutral-500 mt-0.5 uppercase">
            {alert.source}
          </div>
        )}
      </div>
      <button
        onClick={() => onDismiss(alert.id)}
        className="text-neutral-500 hover:text-neutral-300 transition-colors flex-shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function AlertSystem({ alerts, onDismiss }) {
  if (!alerts || alerts.length === 0) return null;

  const criticals = alerts.filter((a) => a.level === 'CRITICAL');
  const others = alerts.filter((a) => a.level !== 'CRITICAL');

  return (
    <>
      {/* Critical overlay - show the most recent critical alert */}
      {criticals.length > 0 && (
        <CriticalOverlay alert={criticals[criticals.length - 1]} onDismiss={onDismiss} />
      )}

      {/* Toast stack for warnings and info */}
      {others.length > 0 && (
        <div className="absolute top-3 right-3 z-50 flex flex-col gap-2 w-80 max-h-[50vh] overflow-y-auto pointer-events-auto">
          {others.map((alert) => (
            <WarningToast key={alert.id} alert={alert} onDismiss={onDismiss} />
          ))}
        </div>
      )}
    </>
  );
}
