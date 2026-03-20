import React, { useState, useEffect } from 'react';
import { Gauge, Activity, Car, Wifi, WifiOff, Zap, ArrowLeft, Settings, Play, Pause } from 'lucide-react';
import useOBDData from './hooks/useOBDData';
import useNurburgringSimulator from './hooks/useNurburgringSimulator';
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
  const [view, setView] = useState('landing');
  const [mode, setMode] = useState('race');
  const [source, setSource] = useState('demo'); // 'demo' or 'obd'

  // Both data sources
  const sim = useNurburgringSimulator(true);
  const obd = useOBDData();

  // Use the active source
  const { data, history, connected, error } = source === 'demo' ? sim : obd;

  const { alerts, dismissAlert, processDataAlerts } = useAlerts();

  useEffect(() => {
    processDataAlerts(data);
  }, [data, processDataAlerts]);

  // Landing Page
  if (view === 'landing') {
    return <LandingPage onEnterDashboard={() => setView('dashboard')} />;
  }

  // Settings Page
  if (view === 'settings') {
    return <SettingsPage onBack={() => setView('dashboard')} />;
  }

  const isDemo = source === 'demo';

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
              {isDemo ? 'Nürburgring Demo' : 'Racing Dashboard'}
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

        {/* Connection + Source + Settings */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {error && (
            <span className="text-red-400 text-[10px] sm:text-xs font-mono-tech hidden lg:inline">{error}</span>
          )}

          {/* Data Source Toggle */}
          <button
            onClick={() => setSource(source === 'demo' ? 'obd' : 'demo')}
            className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 rounded border text-[10px] sm:text-xs font-mono-tech transition-all ${
              isDemo
                ? 'text-amber-400 border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20'
                : 'text-blue-400 border-blue-500/40 bg-blue-500/10 hover:bg-blue-500/20'
            }`}
            title={isDemo ? 'Switch to OBD' : 'Switch to Demo'}
          >
            {isDemo ? <Play className="w-3 h-3" /> : <Wifi className="w-3 h-3" />}
            <span className="hidden sm:inline">{isDemo ? 'DEMO' : 'OBD'}</span>
          </button>

          {/* Demo Play/Pause */}
          {isDemo && (
            <button
              onClick={() => sim.isRunning ? sim.stop() : sim.start()}
              className={`flex items-center px-1.5 py-1 rounded border transition-all ${
                sim.isRunning
                  ? 'text-green-400 border-green-500/40 bg-green-500/10'
                  : 'text-neutral-500 border-neutral-700/50 bg-neutral-900/40'
              }`}
              title={sim.isRunning ? 'Pause simulation' : 'Start simulation'}
            >
              {sim.isRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            </button>
          )}

          {/* Connection Status */}
          <div
            className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded border text-[10px] sm:text-xs font-mono-tech ${
              connected
                ? 'text-green-400 border-green-600/40 bg-green-900/20'
                : 'text-red-400 border-red-600/40 bg-red-900/20'
            }`}
          >
            {connected ? (
              <Wifi className="w-3 h-3" />
            ) : (
              <WifiOff className="w-3 h-3 animate-pulse" />
            )}
            <span className="hidden sm:inline">{connected ? 'LIVE' : 'OFF'}</span>
          </div>

          {/* Settings */}
          <button
            onClick={() => setView('settings')}
            className="flex items-center px-1.5 py-1 rounded border border-neutral-700/50 bg-neutral-900/40
                       text-neutral-500 hover:text-amber-400 hover:border-amber-500/30 transition-all"
            title="Settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative">
        {mode === 'race' && (
          <RaceMode data={data} history={history} connected={connected} isDemo={isDemo} isRunning={isDemo ? sim.isRunning : connected} />
        )}
        {mode === 'telemetry' && (
          <TelemetryMode data={data} history={history} connected={connected} />
        )}
        {mode === 'street' && (
          <StreetMode data={data} history={history} connected={connected} />
        )}
        <AlertSystem alerts={alerts} onDismiss={dismissAlert} />
      </main>
    </div>
  );
}
