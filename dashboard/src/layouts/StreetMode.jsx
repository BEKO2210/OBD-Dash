import React from 'react';
import SpeedMeter from '../panels/SpeedMeter';
import RPMGauge from '../panels/RPMGauge';
import { formatTemp, formatPercentage } from '../utils/formatters';
import { getTempColor } from '../utils/colors';
import { Thermometer, Fuel, Gauge, Wind } from 'lucide-react';

function MiniGauge({ icon: Icon, label, value, displayValue, color, max = 100 }) {
  const pct = value != null ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className="panel-carbon p-2 sm:p-3">
      <div className="flex items-center gap-1.5 mb-1.5 sm:mb-2">
        <Icon className="w-3 h-3 sm:w-3.5 sm:h-3.5" style={{ color }} />
        <span className="text-[9px] sm:text-[10px] font-mono-tech text-neutral-500 tracking-widest">{label}</span>
      </div>
      <div className="font-orbitron text-lg sm:text-2xl font-bold mb-1.5 sm:mb-2" style={{ color }}>
        {displayValue ?? '--'}
      </div>
      <div className="w-full h-1.5 sm:h-2 bg-neutral-800 rounded overflow-hidden">
        <div
          className="h-full rounded transition-all duration-300"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export default function StreetMode({ data, history, connected }) {
  const coolantTemp = data?.coolant_temp ?? null;
  const fuelLevel = data?.fuel_level ?? null;
  const throttle = data?.throttle ?? null;
  const load = data?.load ?? null;
  const iat = data?.iat ?? null;

  const coolantColor = getTempColor(coolantTemp);
  const fuelColor = fuelLevel != null
    ? fuelLevel < 15 ? '#ef4444' : fuelLevel < 30 ? '#f59e0b' : '#22c55e'
    : '#666';

  if (!connected && !data) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="font-orbitron text-xl sm:text-2xl text-neutral-600 mb-2">STREET MODE</div>
          <div className="text-sm font-mono-tech text-neutral-700 animate-pulse">
            Connect OBD adapter...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-2 sm:p-4 gap-2 sm:gap-4 max-w-4xl mx-auto">
      {/* Top: Speed + RPM side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 flex-1 min-h-0">
        <SpeedMeter data={data} />
        <RPMGauge data={data} />
      </div>

      {/* Bottom: Mini gauges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 shrink-0">
        <MiniGauge
          icon={Thermometer}
          label="COOLANT"
          value={coolantTemp}
          displayValue={formatTemp(coolantTemp)}
          color={coolantColor}
          max={130}
        />
        <MiniGauge
          icon={Fuel}
          label="FUEL"
          value={fuelLevel}
          displayValue={fuelLevel != null ? formatPercentage(fuelLevel, 0) : null}
          color={fuelColor}
          max={100}
        />
        <MiniGauge
          icon={Gauge}
          label="THROTTLE"
          value={throttle}
          displayValue={throttle != null ? formatPercentage(throttle, 0) : null}
          color="#f59e0b"
          max={100}
        />
        <MiniGauge
          icon={Wind}
          label="IAT"
          value={iat}
          displayValue={formatTemp(iat)}
          color={iat != null ? (iat > 50 ? '#f97316' : '#3b82f6') : '#666'}
          max={80}
        />
      </div>

      {/* Engine load bar */}
      <div className="panel-carbon p-2 sm:p-3 shrink-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] sm:text-[10px] font-mono-tech text-neutral-500 tracking-widest">ENGINE LOAD</span>
          <span className="text-[10px] sm:text-xs font-mono-tech text-amber-400">
            {load != null ? formatPercentage(load, 0) : '--%'}
          </span>
        </div>
        <div className="w-full h-2 sm:h-3 bg-neutral-800 rounded overflow-hidden border border-neutral-700/50">
          <div
            className="h-full rounded transition-all duration-200"
            style={{
              width: `${load != null ? Math.min(100, load) : 0}%`,
              backgroundColor: load != null
                ? load > 85 ? '#ef4444' : load > 60 ? '#f59e0b' : '#22c55e'
                : '#333',
            }}
          />
        </div>
      </div>
    </div>
  );
}
