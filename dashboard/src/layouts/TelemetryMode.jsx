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
          <div className="font-orbitron text-2xl text-neutral-600 mb-2">TELEMETRY STANDBY</div>
          <div className="text-sm font-mono-tech text-neutral-700 animate-pulse">
            Awaiting data stream...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-2">
      <div className="grid grid-cols-4 gap-2 auto-rows-min">
        {/* Row 1: Core gauges */}
        <div className="col-span-1">
          <RPMGauge data={data} />
        </div>
        <div className="col-span-1">
          <SpeedMeter data={data} />
        </div>
        <div className="col-span-1">
          <GForceBall data={data} history={history} />
        </div>
        <div className="col-span-1">
          <ShiftAdvisor data={data} />
        </div>

        {/* Row 2: Power curve (wide) + AFR + Thermal */}
        <div className="col-span-2">
          <PowerCurve data={data} history={history} />
        </div>
        <div className="col-span-1">
          <AFRMeter data={data} />
        </div>
        <div className="col-span-1">
          <ThermalPanel data={data} history={history} />
        </div>

        {/* Row 3: Brake + Fuel + Traction + Weight */}
        <div className="col-span-1">
          <BrakeAnalysis data={data} />
        </div>
        <div className="col-span-1">
          <div className="panel-carbon p-3 h-full">
            <div className="flex items-center gap-1.5 mb-3">
              <span className="text-xs font-mono-tech text-neutral-500 tracking-widest">FUEL STRATEGY</span>
            </div>
            <FuelStrategy data={data} />
          </div>
        </div>
        <div className="col-span-1">
          <div className="panel-carbon p-3 h-full">
            <div className="text-xs font-mono-tech text-neutral-500 tracking-widest mb-3">TRACTION</div>
            <TractionMonitor data={data} />
          </div>
        </div>
        <div className="col-span-1">
          <WeightTransfer data={data} />
        </div>

        {/* Row 4: Lap Timer + Session Stats */}
        <div className="col-span-2">
          <div className="panel-carbon p-3 h-full">
            <div className="text-xs font-mono-tech text-neutral-500 tracking-widest mb-3">LAP TIMER</div>
            <LapTimer data={data} />
          </div>
        </div>
        <div className="col-span-2">
          <SessionStats data={data} history={history} />
        </div>
      </div>
    </div>
  );
}
