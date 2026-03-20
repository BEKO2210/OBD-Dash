import React, { useState, useEffect, useRef } from 'react';
import { Zap, Gauge, Activity, Timer, Thermometer, Shield, ChevronDown, Play, BarChart3, Cpu, Radio } from 'lucide-react';
import useNurburgringSimulator from '../hooks/useNurburgringSimulator';
import TrackMap from '../components/TrackMap';
import VideoSync from '../components/VideoSync';
import RPMGauge from '../panels/RPMGauge';
import GForceBall from '../panels/GForceBall';
import AFRMeter from '../panels/AFRMeter';
import ThermalPanel from '../panels/ThermalPanel';
import ShiftAdvisor from '../panels/ShiftAdvisor';
import TractionMonitor from '../panels/TractionMonitor';
import SpeedMeter from '../panels/SpeedMeter';
import LapTimer from '../panels/LapTimer';
import { formatSpeed, formatTime, formatRPM } from '../utils/formatters';

// ── Feature Cards Data ──────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: Gauge,
    title: 'Real-Time Telemetry',
    desc: 'Live engine, speed, and G-force data at 10Hz via OBD-II protocol.',
    color: '#f59e0b',
  },
  {
    icon: Cpu,
    title: '8 Algorithm Modules',
    desc: 'Performance, dynamics, thermal, braking, traction, fuel, shift advisor, lap timer.',
    color: '#22c55e',
  },
  {
    icon: Timer,
    title: 'Lap Timing & Delta',
    desc: 'Precision lap timer with sector splits and real-time delta to best lap.',
    color: '#3b82f6',
  },
  {
    icon: Thermometer,
    title: 'Thermal Risk Score',
    desc: 'Predictive temperature monitoring with overheat early warning.',
    color: '#ef4444',
  },
  {
    icon: Shield,
    title: 'Traction Analysis',
    desc: 'Slip ratio, stability state, and ESP intervention detection.',
    color: '#8b5cf6',
  },
  {
    icon: Radio,
    title: 'ELM327 Compatible',
    desc: 'Works with any OBD-II adapter. Bluetooth, WiFi, or USB.',
    color: '#06b6d4',
  },
];

// ── Animated Counter ─────────────────────────────────────────────────────────
function AnimatedNumber({ value, decimals = 0, duration = 1200 }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    const start = display;
    const diff = value - start;
    const startTime = performance.now();

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(start + diff * eased);
      if (progress < 1) {
        ref.current = requestAnimationFrame(animate);
      }
    };

    ref.current = requestAnimationFrame(animate);
    return () => {
      if (ref.current) cancelAnimationFrame(ref.current);
    };
  }, [value, duration]);

  return <>{decimals > 0 ? display.toFixed(decimals) : Math.round(display)}</>;
}

// ── Main Landing Page ────────────────────────────────────────────────────────
export default function LandingPage({ onEnterDashboard }) {
  const {
    data,
    history,
    connected,
    isRunning,
    sectionName,
    start,
  } = useNurburgringSimulator(true);

  const [showDemo, setShowDemo] = useState(false);
  const demoRef = useRef(null);

  const scrollToDemo = () => {
    setShowDemo(true);
    setTimeout(() => {
      demoRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const speed = data?.speed ?? 0;
  const rpm = data?.rpm ?? 0;
  const gear = data?.gear ?? 0;
  const lapTime = data?.lap_time ?? 0;
  const gLat = data?.g_lat ?? 0;
  const gLong = data?.g_long ?? 0;
  const shiftNow = data?.shift_now ?? false;
  const gearDisplay = gear === 0 ? 'N' : gear === -1 ? 'R' : gear;
  const gearColor = shiftNow ? '#ef4444' : '#f59e0b';

  return (
    <div className="min-h-screen bg-[#0a0a0a] overflow-x-hidden">

      {/* ═══════════════════════════════════════════════════════════════════
          HERO SECTION
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-4 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Radial gradient */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{
              width: '140vw',
              height: '140vh',
              background: 'radial-gradient(ellipse at center, rgba(245,158,11,0.06) 0%, rgba(0,0,0,0) 60%)',
            }}
          />
          {/* Grid lines */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `
                linear-gradient(rgba(245,158,11,0.3) 1px, transparent 1px),
                linear-gradient(90deg, rgba(245,158,11,0.3) 1px, transparent 1px)
              `,
              backgroundSize: '60px 60px',
            }}
          />
          {/* Animated scan line */}
          <div
            className="absolute left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-amber-500/20 to-transparent"
            style={{ animation: 'scanLine 4s ease-in-out infinite' }}
          />
        </div>

        {/* Logo & Branding */}
        <div className="relative z-10 text-center mb-6 sm:mb-8" style={{ animation: 'fadeInUp 1s ease-out' }}>
          <div className="flex items-center justify-center gap-3 sm:gap-4 mb-4 sm:mb-6">
            <Zap className="w-8 h-8 sm:w-12 sm:h-12 text-amber-400" style={{ filter: 'drop-shadow(0 0 15px rgba(245,158,11,0.6))' }} />
            <div>
              <h1
                className="font-orbitron text-3xl sm:text-5xl md:text-7xl font-black tracking-[0.15em] sm:tracking-[0.2em] text-amber-400"
                style={{ textShadow: '0 0 30px rgba(245,158,11,0.4), 0 0 60px rgba(245,158,11,0.15)' }}
              >
                APEX CORTEX
              </h1>
              <div className="font-mono-tech text-[10px] sm:text-xs md:text-sm tracking-[0.3em] sm:tracking-[0.5em] text-neutral-500 mt-1">
                RACING TELEMETRY SYSTEM
              </div>
            </div>
          </div>

          <p
            className="font-rajdhani text-base sm:text-xl md:text-2xl text-neutral-400 italic max-w-xl mx-auto mb-2 px-2"
            style={{ animation: 'fadeInUp 1s ease-out 0.3s both' }}
          >
            "Every millisecond. Every molecule. Every edge."
          </p>
          <p
            className="font-rajdhani text-sm sm:text-base text-neutral-600 max-w-lg mx-auto px-2"
            style={{ animation: 'fadeInUp 1s ease-out 0.5s both' }}
          >
            Professional real-time racing dashboard for road-legal performance vehicles
          </p>
        </div>

        {/* Live Stats Bar */}
        <div
          className="relative z-10 flex items-center gap-4 sm:gap-6 md:gap-10 mb-8 sm:mb-12"
          style={{ animation: 'fadeInUp 1s ease-out 0.7s both' }}
        >
          <div className="text-center">
            <div className="font-orbitron text-2xl sm:text-3xl md:text-4xl font-black text-amber-400 text-glow-amber">
              <AnimatedNumber value={speed} />
            </div>
            <div className="font-mono-tech text-[9px] sm:text-[10px] text-neutral-600 tracking-widest">KM/H</div>
          </div>
          <div className="w-px h-8 sm:h-12 bg-neutral-800" />
          <div className="text-center">
            <div
              className="font-orbitron text-3xl sm:text-4xl md:text-5xl font-black"
              style={{ color: gearColor, textShadow: `0 0 20px ${gearColor}60` }}
            >
              {gearDisplay}
            </div>
            <div className="font-mono-tech text-[9px] sm:text-[10px] text-neutral-600 tracking-widest">GEAR</div>
          </div>
          <div className="w-px h-8 sm:h-12 bg-neutral-800" />
          <div className="text-center">
            <div className="font-orbitron text-2xl sm:text-3xl md:text-4xl font-black text-amber-400 text-glow-amber">
              <AnimatedNumber value={rpm} />
            </div>
            <div className="font-mono-tech text-[9px] sm:text-[10px] text-neutral-600 tracking-widest">RPM</div>
          </div>
          <div className="w-px h-8 sm:h-12 bg-neutral-800 hidden sm:block" />
          <div className="text-center hidden sm:block">
            <div className="font-orbitron text-lg sm:text-2xl font-bold text-amber-300">
              {formatTime(lapTime)}
            </div>
            <div className="font-mono-tech text-[9px] sm:text-[10px] text-neutral-600 tracking-widest">LAP TIME</div>
          </div>
        </div>

        {/* CTA Buttons */}
        <div
          className="relative z-10 flex flex-col sm:flex-row gap-3 sm:gap-4 mb-12 sm:mb-16 px-4 w-full sm:w-auto"
          style={{ animation: 'fadeInUp 1s ease-out 0.9s both' }}
        >
          <button
            onClick={onEnterDashboard}
            className="group flex items-center justify-center gap-3 px-6 sm:px-8 py-3 bg-amber-500/10 border-2 border-amber-500 rounded-lg
                       font-orbitron text-xs sm:text-sm font-bold tracking-wider text-amber-400
                       hover:bg-amber-500/20 hover:shadow-[0_0_30px_rgba(245,158,11,0.3)] transition-all duration-300"
          >
            <Gauge className="w-5 h-5" />
            ENTER DASHBOARD
          </button>
          <button
            onClick={scrollToDemo}
            className="flex items-center justify-center gap-3 px-6 sm:px-8 py-3 bg-neutral-800/50 border border-neutral-700 rounded-lg
                       font-orbitron text-xs sm:text-sm font-bold tracking-wider text-neutral-400
                       hover:bg-neutral-800 hover:text-neutral-200 hover:border-neutral-600 transition-all duration-300"
          >
            <Play className="w-5 h-5" />
            LIVE DEMO
          </button>
        </div>

        {/* Track Map (mini preview in hero) */}
        <div
          className="relative z-10 w-full max-w-2xl mx-auto opacity-40 hover:opacity-70 transition-opacity duration-500 px-4"
          style={{ animation: 'fadeInUp 1.2s ease-out 1.1s both' }}
        >
          <TrackMap
            trackX={data?.track_x}
            trackY={data?.track_y}
            sectionName={null}
            className="h-[150px] sm:h-[200px]"
          />
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronDown className="w-5 h-5 sm:w-6 sm:h-6 text-neutral-600" />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          FEATURES SECTION
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-12 sm:py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="font-orbitron text-xl sm:text-2xl md:text-3xl font-bold tracking-wider text-amber-400 text-glow-amber mb-3">
              ENGINEERED FOR THE EDGE
            </h2>
            <p className="font-rajdhani text-base sm:text-lg text-neutral-500 max-w-2xl mx-auto px-2">
              8 real-time algorithm modules process every sensor reading to give you a competitive advantage on track and street.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {FEATURES.map((feat, i) => {
              const Icon = feat.icon;
              return (
                <div
                  key={i}
                  className="panel-carbon p-4 sm:p-5 group hover:border-amber-500/30 transition-all duration-300"
                >
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div
                      className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: feat.color + '15', border: `1px solid ${feat.color}30` }}
                    >
                      <Icon className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: feat.color }} />
                    </div>
                    <div>
                      <h3 className="font-orbitron text-xs sm:text-sm font-bold tracking-wider text-neutral-200 mb-1">
                        {feat.title.toUpperCase()}
                      </h3>
                      <p className="font-rajdhani text-xs sm:text-sm text-neutral-500 leading-relaxed">
                        {feat.desc}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          VEHICLE SUPPORT SECTION
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-12 sm:py-16 px-4 border-t border-neutral-800/50">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="font-orbitron text-lg sm:text-xl font-bold tracking-wider text-neutral-400 mb-6 sm:mb-8">
            SUPPORTED PLATFORMS
          </h2>
          <div className="flex flex-wrap justify-center gap-3 sm:gap-6 md:gap-12">
            {['Mercedes-AMG', 'BMW M', 'Audi RS', 'Porsche GT', 'OBD-II Generic'].map((brand) => (
              <div
                key={brand}
                className="px-3 sm:px-5 py-2 sm:py-2.5 border border-neutral-800 rounded-lg font-orbitron text-[10px] sm:text-xs tracking-wider text-neutral-500
                           hover:text-amber-400 hover:border-amber-500/30 transition-all duration-300"
              >
                {brand.toUpperCase()}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          LIVE DEMO SECTION - Nurburgring Simulation
          ═══════════════════════════════════════════════════════════════════ */}
      <section
        ref={demoRef}
        className="py-12 sm:py-16 px-4 border-t border-neutral-800/50"
        id="live-demo"
      >
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-6 sm:mb-8">
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-full mb-4">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="font-mono-tech text-[10px] sm:text-xs text-amber-400 tracking-wider">LIVE SIMULATION</span>
            </div>
            <h2 className="font-orbitron text-xl sm:text-2xl md:text-3xl font-bold tracking-wider text-amber-400 text-glow-amber mb-2">
              NURBURGRING NORDSCHLEIFE
            </h2>
            <p className="font-rajdhani text-base sm:text-lg text-neutral-500">
              20.832 km -- Full telemetry simulation running in your browser
            </p>
          </div>

          {/* Engine sound bar (audio only, no video) */}
          <div className="mb-3 sm:mb-4">
            <VideoSync
              lapTimeMs={data?.lap_time ?? 0}
              isRunning={isRunning}
              isDemo={true}
              className=""
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 sm:gap-4 mb-3 sm:mb-4">
            {/* Track Map - 3 cols */}
            <div className="lg:col-span-3 panel-carbon p-3 sm:p-4 relative" style={{ minHeight: '300px' }}>
              <div className="absolute top-3 left-3 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="font-mono-tech text-[10px] text-green-400 tracking-wider">TRACKING</span>
              </div>
              <TrackMap
                trackX={data?.track_x}
                trackY={data?.track_y}
                sectionName={sectionName}
                className="h-full w-full"
              />
            </div>

            {/* Speed / Gear / Lap Column - 2 cols */}
            <div className="lg:col-span-2 flex flex-col gap-3 sm:gap-4">
              {/* Big Speed Display */}
              <div className="panel-carbon p-4 sm:p-6 text-center flex-1 flex flex-col justify-center">
                <div
                  className="font-orbitron text-[56px] sm:text-[80px] md:text-[100px] font-black leading-none text-amber-400"
                  style={{ textShadow: '0 0 30px rgba(245,158,11,0.4), 0 0 60px rgba(245,158,11,0.15)', letterSpacing: '-0.02em' }}
                >
                  {formatSpeed(speed)}
                </div>
                <div className="font-mono-tech text-[10px] sm:text-xs text-neutral-500 tracking-[0.3em] -mt-1">KM/H</div>

                <div className="flex items-center justify-center gap-6 sm:gap-8 mt-3 sm:mt-4">
                  <div className="text-center">
                    <div className="font-mono-tech text-[10px] text-neutral-600 tracking-widest">GEAR</div>
                    <div
                      className={`font-orbitron text-3xl sm:text-4xl font-black ${shiftNow ? 'shift-light-blink' : ''}`}
                      style={{ color: gearColor, textShadow: `0 0 15px ${gearColor}60` }}
                    >
                      {gearDisplay}
                    </div>
                  </div>
                  <div className="w-px h-10 sm:h-12 bg-neutral-800" />
                  <div className="text-center">
                    <div className="font-mono-tech text-[10px] text-neutral-600 tracking-widest">LAP</div>
                    <div className="font-orbitron text-base sm:text-lg font-bold text-amber-300">
                      {formatTime(lapTime)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Mini Stats Grid */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="panel-carbon p-2.5 sm:p-3 text-center">
                  <div className="font-mono-tech text-[10px] text-neutral-600 tracking-widest mb-1">G-LAT</div>
                  <div className="font-orbitron text-lg sm:text-xl font-bold text-amber-400">
                    {(gLat ?? 0).toFixed(2)}
                  </div>
                </div>
                <div className="panel-carbon p-2.5 sm:p-3 text-center">
                  <div className="font-mono-tech text-[10px] text-neutral-600 tracking-widest mb-1">G-LONG</div>
                  <div className="font-orbitron text-lg sm:text-xl font-bold text-amber-400">
                    {(gLong ?? 0).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Dashboard Panels Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-3 sm:mb-4">
            <RPMGauge data={data} />
            <GForceBall data={data} history={history} />
            <ShiftAdvisor data={data} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <ThermalPanel data={data} history={history} />
            <AFRMeter data={data} />
            <div className="panel-carbon p-3">
              <div className="text-xs font-mono-tech text-neutral-500 tracking-widest mb-3">TRACTION</div>
              <TractionMonitor data={data} />
            </div>
          </div>

          {/* Enter Dashboard CTA */}
          <div className="text-center mt-8 sm:mt-12">
            <button
              onClick={onEnterDashboard}
              className="group inline-flex items-center gap-3 px-8 sm:px-10 py-3 sm:py-4 bg-amber-500/10 border-2 border-amber-500 rounded-lg
                         font-orbitron text-sm sm:text-base font-bold tracking-wider text-amber-400
                         hover:bg-amber-500/20 hover:shadow-[0_0_40px_rgba(245,158,11,0.3)] transition-all duration-300"
            >
              <Gauge className="w-5 h-5 group-hover:animate-spin" style={{ animationDuration: '2s' }} />
              OPEN FULL DASHBOARD
            </button>
            <p className="font-mono-tech text-[10px] sm:text-xs text-neutral-600 mt-3 tracking-wider">
              3 MODES: RACE | TELEMETRY | STREET
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          FOOTER
          ═══════════════════════════════════════════════════════════════════ */}
      <footer className="py-6 sm:py-8 px-4 border-t border-neutral-800/50">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-4 text-center md:text-left">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <span className="font-orbitron text-xs tracking-[0.2em] text-amber-400/60">
              APEX CORTEX
            </span>
            <span className="font-mono-tech text-[10px] text-neutral-700">v0.1.0-alpha</span>
          </div>
          <div className="font-rajdhani text-sm text-neutral-600">
            Every sensor read is a competitive advantage.
          </div>
          <div className="font-mono-tech text-[10px] text-neutral-700 tracking-wider">
            NORDSCHLEIFE SIM {isRunning ? 'ACTIVE' : 'PAUSED'}
          </div>
        </div>
      </footer>
    </div>
  );
}
