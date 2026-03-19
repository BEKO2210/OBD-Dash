import React, { useMemo } from 'react';
import { gaugeZoneColors } from '../utils/colors';
import { formatRPM } from '../utils/formatters';

export default function ShiftAdvisor({ data }) {
  const gear = data?.gear ?? null;
  const rpm = data?.rpm ?? 0;
  const maxRpm = data?.max_rpm ?? 7000;
  const shiftRpm = data?.shift_rpm ?? maxRpm * 0.9;
  const shiftNow = data?.shift_now ?? false;

  const rpmPct = maxRpm > 0 ? rpm / maxRpm : 0;

  // 10 LED shift lights
  const leds = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 10; i++) {
      const threshold = 0.65 + (i / 10) * 0.35;
      const isLit = rpmPct >= threshold;
      let color;
      if (i < 4) color = gaugeZoneColors.green;
      else if (i < 7) color = gaugeZoneColors.yellow;
      else color = gaugeZoneColors.red;
      arr.push({ isLit, color });
    }
    return arr;
  }, [rpmPct]);

  const gearDisplay = gear != null ? (gear === 0 ? 'N' : gear === -1 ? 'R' : gear) : '-';
  const gearColor = shiftNow ? '#ef4444' : '#f59e0b';

  return (
    <div className="panel-carbon p-3 flex flex-col items-center">
      <div className="text-xs font-mono-tech text-neutral-500 tracking-widest mb-2">SHIFT ADVISOR</div>

      {/* Gear display */}
      <div
        className={`font-orbitron text-6xl font-black leading-none mb-3 ${
          shiftNow ? 'shift-light-blink' : ''
        }`}
        style={{
          color: gearColor,
          textShadow: `0 0 20px ${gearColor}80, 0 0 40px ${gearColor}30`,
        }}
      >
        {gearDisplay}
      </div>

      {/* Shift light strip */}
      <div className="flex gap-1 mb-3">
        {leds.map((led, i) => (
          <div
            key={i}
            className={`w-4 h-6 rounded-sm ${led.isLit && shiftNow ? 'shift-light-blink' : ''}`}
            style={{
              backgroundColor: led.isLit ? led.color : '#1a1a1a',
              boxShadow: led.isLit ? `0 0 8px ${led.color}` : 'none',
              border: `1px solid ${led.isLit ? led.color : '#333'}`,
            }}
          />
        ))}
      </div>

      {/* Optimal shift RPM */}
      <div className="text-center">
        <div className="text-[10px] font-mono-tech text-neutral-500">SHIFT AT</div>
        <div className="font-mono-tech text-sm text-amber-400">{formatRPM(shiftRpm)} RPM</div>
      </div>

      {/* Shift now banner */}
      {shiftNow && (
        <div className="mt-2 px-4 py-1 bg-red-600/30 border border-red-500 rounded text-red-300 text-xs font-orbitron font-bold shift-light-blink tracking-widest">
          SHIFT NOW
        </div>
      )}
    </div>
  );
}
