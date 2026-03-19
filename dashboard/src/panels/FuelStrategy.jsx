import { useOBDData } from '../hooks/useOBDData';

export default function FuelStrategy() {
  const { data } = useOBDData();
  const fuel = data?.calc?.fuel || {};
  const obd = data?.obd || {};

  const fuelLevel = obd.fuel_level ?? 0;
  const afr = fuel.afr ?? 14.7;
  const afrStatus = fuel.afr_status ?? 'stoich';
  const consumption = fuel.consumption_l100km ?? 0;
  const range = fuel.range_km ?? 0;
  const pitWindow = fuel.pit_window_laps ?? 0;

  const statusColors = {
    lean: 'text-blue-400', stoich: 'text-green-400',
    optimal_race: 'text-amber-400', rich: 'text-red-400'
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
      <h3 className="text-xs text-neutral-500 uppercase tracking-wider mb-3">Fuel Strategy</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className="text-xs text-neutral-500">AFR</span>
          <p className={`text-lg font-bold ${statusColors[afrStatus] || 'text-white'}`}>{afr.toFixed(1)}</p>
          <span className={`text-xs ${statusColors[afrStatus]}`}>{afrStatus.toUpperCase()}</span>
        </div>
        <div>
          <span className="text-xs text-neutral-500">Consumption</span>
          <p className="text-lg font-bold text-white">{consumption.toFixed(1)}</p>
          <span className="text-xs text-neutral-500">L/100km</span>
        </div>
        <div>
          <span className="text-xs text-neutral-500">Range</span>
          <p className="text-lg font-bold text-amber-400">{Math.round(range)} km</p>
        </div>
        <div>
          <span className="text-xs text-neutral-500">Pit Window</span>
          <p className="text-lg font-bold text-white">{pitWindow.toFixed(0)} laps</p>
        </div>
      </div>
      <div className="mt-3">
        <div className="flex justify-between text-xs text-neutral-500 mb-1">
          <span>Fuel Level</span><span>{fuelLevel.toFixed(0)}%</span>
        </div>
        <div className="w-full bg-neutral-800 rounded-full h-2">
          <div className="h-2 rounded-full transition-all" style={{width: `${fuelLevel}%`, backgroundColor: fuelLevel > 25 ? '#22c55e' : fuelLevel > 10 ? '#f59e0b' : '#ef4444'}} />
        </div>
      </div>
    </div>
  );
}
