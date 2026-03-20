import React from 'react';

export default function FuelStrategy({ data }) {
  const fuelLevel = data?.fuel_level ?? 0;
  const afr = data?.afr ?? 14.7;
  const consumption = data?.fuel_consumption ?? 0;
  const fuelRemaining = data?.fuel_remaining ?? 0;

  const afrStatus = afr < 12.5 ? 'rich' : afr < 13.5 ? 'optimal_race' : afr < 15.0 ? 'stoich' : 'lean';
  const range = consumption > 0 ? (fuelRemaining / consumption) * 100 : 0;
  const pitWindow = range > 0 ? Math.floor(range / 20.8) : 0; // Nordschleife laps

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
          <p className="text-lg font-bold text-white">{pitWindow} laps</p>
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
