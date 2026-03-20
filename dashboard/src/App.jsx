import React, { useState, useEffect } from 'react';
import { Gauge, Activity, Car, Wifi, WifiOff, Zap, ArrowLeft, Settings } from 'lucide-react';
import useOBDData from './hooks/useOBDData';
import useAlerts from './hooks/useAlerts';
import RaceMode from './layouts/RaceMode';
import TelemetryMode from './layouts/TelemetryMode';
import StreetMode from './layouts/StreetMode';
import AlertSystem from './panels/AlertSystem';
import LandingPage from './pages/LandingPage';
import SettingsPage from './pages/SettingsPage';

const MODES = [
  { id: 'race', label: 'RACE', icon: Gauge, color: 'text-red-400 border-red-500 bg-red-500/10' },
  { id: 'telemetry', label: 'TELEMETRY', icon: Activity, color: 'text-amber-400 border-amber-500 bg-amber-500/10' },
  { id: 'street', label: 'STREET', icon: Car, color: 'text-green-400 border-green-500 bg-green-500/10' },
];

export default function App() {
  const [view, setView] = useState('landing'); // 'landing', 'dashboard', 'settings'
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

  // Settings Page
  if (view === 'settings') {
    return <SettingsPage onBack={() => setView('dashboard')} />;
  }

  // Dashboard View
  return (
    <div className="h-screen bg-[#0a0a0a] flex flex-col overflow-hidden">
      {/* Header Bar */}
      <header className="flex items-center justify-between px-2 sm:px-4 py-1.5 sm:py-2 border-b border-neutral-800/60 bg-neutral-950/90 backdrop-blur-md z-50 shrink-0">
        {/* Logo + Back */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setView('landing')}
            className="flex items-center gap-1 text-neutral-500 hover:text-amber-400 transition-colors"
            title="Back to Landing"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
          <div className="hidden sm:flex flex-col leading-none">
            <span className="font-orbitron text-xs sm:text-sm font-bold tracking-[0.25em] text-amber-400 text-glow-amber">
              APEX CORTEX
            </span>
            <span className="text-[9px] sm:text-[10px] tracking-[0.3em] text-neutral-500 font-rajdhani uppercase">
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
                  flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1 sm:py-1.5 rounded border text-[10px] sm:text-xs font-orbitron font-semibold
                  tracking-wider transition-all duration-200 uppercase
                  ${isActive
                    ? m.color + ' shadow-lg'
                    : 'text-neutral-500 border-neutral-700/50 bg-neutral-900/40 hover:text-neutral-300 hover:border-neutral-600'
                  }
                `}
              >
                <Icon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span className="hidden sm:inline">{m.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Connection Status + Settings */}
        <div className="flex items-center gap-2 sm:gap-3">
          {error && (
            <span className="text-red-400 text-[10px] sm:text-xs font-mono-tech hidden sm:inline">{error}</span>
          )}
          <div
            className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 rounded border text-[10px] sm:text-xs font-mono-tech ${
              connected
                ? 'text-green-400 border-green-600/40 bg-green-900/20'
                : 'text-red-400 border-red-600/40 bg-red-900/20'
            }`}
          >
            {connected ? (
              <Wifi className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            ) : (
              <WifiOff className="w-3 h-3 sm:w-3.5 sm:h-3.5 animate-pulse" />
            )}
            <span className="hidden sm:inline">{connected ? 'LIVE' : 'OFFLINE'}</span>
          </div>
          <button
            onClick={() => setView('settings')}
            className="flex items-center gap-1 px-2 py-1 rounded border border-neutral-700/50 bg-neutral-900/40
                       text-neutral-500 hover:text-amber-400 hover:border-amber-500/30 transition-all duration-200"
            title="Settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
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
