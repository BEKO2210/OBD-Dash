import React from 'react';
import RPMGauge from '../panels/RPMGauge';
import SpeedMeter from '../panels/SpeedMeter';
import GForceBall from '../panels/GForceBall';
import AFRMeter from '../panels/AFRMeter';
import ThermalPanel from '../panels/ThermalPanel';
import BrakeAnalysis from '../panels/BrakeAnalysis';
import PowerCurve from '../panels/PowerCurve';
import ShiftAdvisor from '../panels/ShiftAdvisor';
import LapTimer from '../panels/LapTimer';
import FuelStrategy from '../panels/FuelStrategy';
import TractionMonitor from '../panels/TractionMonitor';
import WeightTransfer from '../panels/WeightTransfer';
import SessionStats from '../panels/SessionStats';

export default function TelemetryMode({ data, history, connected }) {
  if (!connected && !data) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="font-orbitron text-xl sm:text-2xl text-neutral-600 mb-2">TELEMETRY STANDBY</div>
          <div className="text-sm font-mono-tech text-neutral-700 animate-pulse">
            Awaiting data stream...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-1.5 sm:p-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1.5 sm:gap-2 auto-rows-min">
        {/* Row 1: Core gauges */}
        <div>
          <RPMGauge data={data} />
        </div>
        <div>
          <SpeedMeter data={data} />
        </div>
        <div>
          <GForceBall data={data} history={history} />
        </div>
        <div>
          <ShiftAdvisor data={data} />
        </div>

        {/* Row 2: Power curve (wide) + AFR + Thermal */}
        <div className="sm:col-span-2">
          <PowerCurve data={data} history={history} />
        </div>
        <div>
          <AFRMeter data={data} />
        </div>
        <div>
          <ThermalPanel data={data} history={history} />
        </div>

        {/* Row 3: Brake + Fuel + Traction + Weight */}
        <div>
          <BrakeAnalysis data={data} />
        </div>
        <div>
          <div className="panel-carbon p-2 sm:p-3 h-full">
            <div className="flex items-center gap-1.5 mb-2 sm:mb-3">
              <span className="text-[10px] sm:text-xs font-mono-tech text-neutral-500 tracking-widest">FUEL STRATEGY</span>
            </div>
            <FuelStrategy data={data} />
          </div>
        </div>
        <div>
          <div className="panel-carbon p-2 sm:p-3 h-full">
            <div className="text-[10px] sm:text-xs font-mono-tech text-neutral-500 tracking-widest mb-2 sm:mb-3">TRACTION</div>
            <TractionMonitor data={data} />
          </div>
        </div>
        <div>
          <WeightTransfer data={data} />
        </div>

        {/* Row 4: Lap Timer + Session Stats */}
        <div className="sm:col-span-2">
          <div className="panel-carbon p-2 sm:p-3 h-full">
            <div className="text-[10px] sm:text-xs font-mono-tech text-neutral-500 tracking-widest mb-2 sm:mb-3">LAP TIMER</div>
            <LapTimer data={data} />
          </div>
        </div>
        <div className="sm:col-span-2">
          <SessionStats data={data} history={history} />
        </div>
      </div>
    </div>
  );
}
