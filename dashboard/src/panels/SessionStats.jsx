import React, { useMemo } from 'react';
import { BarChart3, Clock, Gauge, Zap } from 'lucide-react';
import { formatTime, formatSpeed, formatRPM, formatTemp } from '../utils/formatters';

function StatCard({ label, value, unit, icon: Icon, color = '#f59e0b' }) {
  return (
    <div className="bg-neutral-800/40 rounded p-2.5">
      <div className="flex items-center gap-1 mb-1">
        {Icon && <Icon className="w-3 h-3" style={{ color }} />}
        <span className="text-[9px] font-mono-tech text-neutral-500 tracking-wider">
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <span
          className="font-orbitron text-lg font-bold"
          style={{ color, textShadow: `0 0 8px ${color}30` }}
        >
          {value ?? '--'}
        </span>
        {unit && (
          <span className="text-[10px] font-mono-tech text-neutral-500">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

export default function SessionStats({ data, history }) {
  const stats = useMemo(() => {
    if (!history || history.length === 0) {
      return {
        maxSpeed: null,
        maxRpm: null,
        avgSpeed: null,
        maxGLat: null,
        maxGLong: null,
        maxCoolant: null,
        sessionDuration: null,
        dataPoints: 0,
      };
    }

    let maxSpeed = -Infinity;
    let maxRpm = -Infinity;
    let totalSpeed = 0;
    let speedCount = 0;
    let maxGLat = 0;
    let maxGLong = 0;
    let maxCoolant = -Infinity;

    for (const entry of history) {
      if (entry.speed != null) {
        maxSpeed = Math.max(maxSpeed, entry.speed);
        totalSpeed += entry.speed;
        speedCount++;
      }
      if (entry.rpm != null) {
        maxRpm = Math.max(maxRpm, entry.rpm);
      }
      if (entry.g_lat != null) {
        maxGLat = Math.max(maxGLat, Math.abs(entry.g_lat));
      }
      if (entry.g_long != null) {
        maxGLong = Math.max(maxGLong, Math.abs(entry.g_long));
      }
      if (entry.coolant_temp != null) {
        maxCoolant = Math.max(maxCoolant, entry.coolant_temp);
      }
    }

    const firstTs = history[0]?._historyTs || history[0]?.timestamp;
    const lastTs =
      history[history.length - 1]?._historyTs ||
      history[history.length - 1]?.timestamp;
    const durationMs =
      firstTs && lastTs ? lastTs - firstTs : null;

    return {
      maxSpeed: maxSpeed > -Infinity ? Math.round(maxSpeed) : null,
      maxRpm: maxRpm > -Infinity ? Math.round(maxRpm) : null,
      avgSpeed:
        speedCount > 0 ? Math.round(totalSpeed / speedCount) : null,
      maxGLat: maxGLat > 0 ? maxGLat.toFixed(2) : null,
      maxGLong: maxGLong > 0 ? maxGLong.toFixed(2) : null,
      maxCoolant: maxCoolant > -Infinity ? Math.round(maxCoolant) : null,
      sessionDuration: durationMs,
      dataPoints: history.length,
    };
  }, [history]);

  const sessionTime = data?.session_time ?? stats.sessionDuration;
  const lapCount = data?.lap_count ?? null;
  const bestLap = data?.best_lap ?? null;

  return (
    <div className="panel-carbon p-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <BarChart3 className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-mono-tech text-neutral-500 tracking-widest">
            SESSION STATS
          </span>
        </div>
        <span className="text-[10px] font-mono-tech text-neutral-600">
          {stats.dataPoints} samples
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-2">
        <StatCard
          label="MAX SPEED"
          value={stats.maxSpeed}
          unit="km/h"
          icon={Gauge}
          color="#22c55e"
        />
        <StatCard
          label="MAX RPM"
          value={stats.maxRpm != null ? formatRPM(stats.maxRpm) : null}
          icon={Zap}
          color="#f97316"
        />
        <StatCard
          label="AVG SPEED"
          value={stats.avgSpeed}
          unit="km/h"
          icon={Gauge}
          color="#3b82f6"
        />
      </div>

      <div className="grid grid-cols-3 gap-2 mb-2">
        <StatCard
          label="MAX LAT G"
          value={stats.maxGLat}
          unit="G"
          color="#a855f7"
        />
        <StatCard
          label="MAX LON G"
          value={stats.maxGLong}
          unit="G"
          color="#ec4899"
        />
        <StatCard
          label="MAX COOLANT"
          value={stats.maxCoolant != null ? `${stats.maxCoolant}` : null}
          unit={stats.maxCoolant != null ? '\u00b0C' : ''}
          color={
            stats.maxCoolant != null && stats.maxCoolant > 110
              ? '#ef4444'
              : '#f59e0b'
          }
        />
      </div>

      {/* Bottom row: session time, laps, best lap */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard
          label="SESSION"
          value={
            sessionTime != null
              ? formatTime(sessionTime)
              : '--:--.---'
          }
          icon={Clock}
          color="#f59e0b"
        />
        <StatCard
          label="LAPS"
          value={lapCount}
          color="#22c55e"
        />
        <StatCard
          label="BEST LAP"
          value={bestLap != null ? formatTime(bestLap) : null}
          color="#fbbf24"
        />
      </div>
    </div>
  );
}
