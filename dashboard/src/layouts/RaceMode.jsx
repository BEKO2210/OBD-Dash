import React from 'react';
import { formatSpeed, formatTime } from '../utils/formatters';
import RPMGauge from '../panels/RPMGauge';
import GForceBall from '../panels/GForceBall';
import AFRMeter from '../panels/AFRMeter';
import ThermalPanel from '../panels/ThermalPanel';
import ShiftAdvisor from '../panels/ShiftAdvisor';
import TractionMonitor from '../panels/TractionMonitor';
import VideoSync from '../components/VideoSync';

export default function RaceMode({ data, history, connected, isDemo = false, isRunning = false }) {
  const speed = data?.speed ?? 0;
  const gear = data?.gear ?? null;
  const lapTime = data?.lap_time ?? null;
  const bestLap = data?.best_lap ?? null;
  const delta = data?.delta ?? null;
  const shiftNow = data?.shift_now ?? false;

  const gearDisplay = gear != null ? (gear === 0 ? 'N' : gear === -1 ? 'R' : gear) : '-';
  const gearColor = shiftNow ? '#ef4444' : '#f59e0b';

  const deltaColor = delta == null ? '#666' : delta < 0 ? '#22c55e' : '#ef4444';

  if (!connected && !data) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="font-orbitron text-xl sm:text-2xl text-neutral-600 mb-2">AWAITING TELEMETRY</div>
          <div className="text-sm font-mono-tech text-neutral-700 animate-pulse">Connecting to ECU...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-1.5 sm:p-2 gap-1.5 sm:gap-2">
      {/* TOP BAR: Gear | Speed | Lap Time */}
      <div className="flex items-center justify-between shrink-0">
        {/* Gear indicator - left */}
        <div className="flex flex-col items-center w-16 sm:w-24 md:w-32">
          <div className="text-[9px] sm:text-[10px] font-mono-tech text-neutral-600 tracking-widest">GEAR</div>
          <div
            className={`font-orbitron text-4xl sm:text-5xl md:text-7xl font-black leading-none ${shiftNow ? 'shift-light-blink' : ''}`}
            style={{
              color: gearColor,
              textShadow: `0 0 25px ${gearColor}80, 0 0 50px ${gearColor}30`,
            }}
          >
            {gearDisplay}
          </div>
        </div>

        {/* Speed - center (HUGE) */}
        <div className="flex-1 text-center">
          <div
            className="font-orbitron text-[60px] sm:text-[80px] md:text-[100px] lg:text-[120px] font-black leading-none text-amber-400 text-glow-amber"
            style={{ letterSpacing: '-0.02em' }}
          >
            {formatSpeed(speed)}
          </div>
          <div className="text-[10px] sm:text-xs font-mono-tech text-neutral-500 tracking-[0.3em] -mt-1 sm:-mt-2">KM/H</div>
        </div>

        {/* Lap time - right */}
        <div className="flex flex-col items-center w-24 sm:w-36 md:w-48">
          <div className="text-[9px] sm:text-[10px] font-mono-tech text-neutral-600 tracking-widest">LAP TIME</div>
          <div className="font-orbitron text-lg sm:text-xl md:text-2xl font-bold text-amber-300 tracking-wider">
            {formatTime(lapTime)}
          </div>
          <div className="flex gap-2 sm:gap-3 mt-1">
            <div className="text-center">
              <div className="text-[8px] sm:text-[9px] font-mono-tech text-neutral-600">BEST</div>
              <div className="text-[10px] sm:text-xs font-mono-tech text-amber-400/70">{formatTime(bestLap)}</div>
            </div>
            <div className="text-center">
              <div className="text-[8px] sm:text-[9px] font-mono-tech text-neutral-600">DELTA</div>
              <div
                className="text-[10px] sm:text-xs font-mono-tech font-bold"
                style={{ color: deltaColor }}
              >
                {delta != null
                  ? `${delta >= 0 ? '+' : '-'}${(Math.abs(delta) / 1000).toFixed(3)}`
                  : '---.---'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Audio-only engine sound bar */}
      <VideoSync
        lapTimeMs={data?.lap_time ?? 0}
        isRunning={isRunning}
        isDemo={isDemo}
        className="shrink-0"
      />

      {/* MIDDLE ROW: RPM | G-Force | AFR */}
      <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-1.5 sm:gap-2 min-h-0">
        <RPMGauge data={data} />
        <GForceBall data={data} history={history} />
        <AFRMeter data={data} />
      </div>

      {/* BOTTOM ROW: Thermal | Shift | Traction */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 sm:gap-2 shrink-0">
        <ThermalPanel data={data} history={history} />
        <ShiftAdvisor data={data} />
        <div className="hidden sm:block panel-carbon p-2 sm:p-3">
          <div className="text-[10px] sm:text-xs font-mono-tech text-neutral-500 tracking-widest mb-2 sm:mb-3">TRACTION</div>
          <TractionMonitor data={data} />
        </div>
      </div>
    </div>
  );
}
