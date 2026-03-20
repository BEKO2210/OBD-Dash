import React, { useState, useEffect } from 'react';
import { Gauge, Activity, Car, Wifi, WifiOff, Zap, ArrowLeft } from 'lucide-react';
import useOBDData from './hooks/useOBDData';
import useAlerts from './hooks/useAlerts';
import RaceMode from './layouts/RaceMode';
import TelemetryMode from './layouts/TelemetryMode';
import StreetMode from './layouts/StreetMode';
import AlertSystem from './panels/AlertSystem';
import LandingPage from './pages/LandingPage';

const MODES = [
  { id: 'race', label: 'RACE', icon: Gauge, color: 'text-red-400 border-red-500 bg-red-500/10' },
  { id: 'telemetry', label: 'TELEMETRY', icon: Activity, color: 'text-amber-400 border-amber-500 bg-amber-500/10' },
  { id: 'street', label: 'STREET', icon: Car, color: 'text-green-400 border-green-500 bg-green-500/10' },
];

export default function App() {
  const [view, setView] = useState('landing'); // 'landing' or 'dashboard'
  const [mode, setMode] = useState('race');
  const { data, history, connected, error } = useOBDData();
  const { alerts, dismissAlert, processDataAlerts } = useAlerts();

  // Process incoming alerts from data
  useEffect(() => {
    processDataAlerts(data);
  }, [data, processDataAlerts]);

  const currentMode = MODES.find((m) => m.id === mode);

  // Landing Page
  if (view === 'landing') {
    return <LandingPage onEnterDashboard={() => setView('dashboard')} />;
  }

  // Dashboard View
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      {/* Header Bar */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-neutral-800/60 bg-neutral-950/90 backdrop-blur-md z-50">
        {/* Logo + Back */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView('landing')}
            className="flex items-center gap-1 text-neutral-500 hover:text-amber-400 transition-colors mr-2"
            title="Back to Landing"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <Zap className="w-6 h-6 text-amber-400" />
          <div className="flex flex-col leading-none">
            <span className="font-orbitron text-sm font-bold tracking-[0.25em] text-amber-400 text-glow-amber">
              APEX CORTEX
            </span>
            <span className="text-[10px] tracking-[0.3em] text-neutral-500 font-rajdhani uppercase">
              Racing Dashboard
            </span>
          </div>
        </div>

        {/* Mode Switcher */}
        <nav className="flex items-center gap-1">
          {MODES.map((m) => {
            const Icon = m.icon;
            const isActive = mode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`
                  flex items-center gap-2 px-4 py-1.5 rounded border text-xs font-orbitron font-semibold
                  tracking-wider transition-all duration-200 uppercase
                  ${isActive
                    ? m.color + ' shadow-lg'
                    : 'text-neutral-500 border-neutral-700/50 bg-neutral-900/40 hover:text-neutral-300 hover:border-neutral-600'
                  }
                `}
              >
                <Icon className="w-3.5 h-3.5" />
                {m.label}
              </button>
            );
          })}
        </nav>

        {/* Connection Status */}
        <div className="flex items-center gap-3">
          {error && (
            <span className="text-red-400 text-xs font-mono-tech">{error}</span>
          )}
          <div
            className={`flex items-center gap-2 px-3 py-1 rounded border text-xs font-mono-tech ${
              connected
                ? 'text-green-400 border-green-600/40 bg-green-900/20'
                : 'text-red-400 border-red-600/40 bg-red-900/20'
            }`}
          >
            {connected ? (
              <Wifi className="w-3.5 h-3.5" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 animate-pulse" />
            )}
            {connected ? 'LIVE' : 'OFFLINE'}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative">
        {mode === 'race' && (
          <RaceMode data={data} history={history} connected={connected} />
        )}
        {mode === 'telemetry' && (
          <TelemetryMode data={data} history={history} connected={connected} />
        )}
        {mode === 'street' && (
          <StreetMode data={data} history={history} connected={connected} />
        )}

        {/* Alert Overlay */}
        <AlertSystem alerts={alerts} onDismiss={dismissAlert} />
      </main>
    </div>
  );
}
