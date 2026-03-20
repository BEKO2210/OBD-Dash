import React, { useState } from 'react';
import {
  ArrowLeft,
  Zap,
  Gauge,
  Thermometer,
  Palette,
  Wifi,
  Monitor,
  Bell,
  Database,
  RotateCcw,
  Save,
  Check,
} from 'lucide-react';

const DEFAULTS = {
  units_speed: 'kmh',
  units_temp: 'celsius',
  units_pressure: 'kpa',
  units_power: 'kw',
  poll_rate_critical: 10,
  poll_rate_standard: 2,
  poll_rate_slow: 0.5,
  theme: 'carbon',
  accent_color: 'amber',
  connection_type: 'simulator',
  connection_address: '',
  alerts_enabled: true,
  alert_coolant_max: 110,
  alert_oil_max: 130,
  alert_rpm_max: 7000,
  alert_fuel_min: 10,
  session_auto_record: false,
  session_format: 'json',
  display_fps: 60,
  smoothing_enabled: true,
};

function loadSettings() {
  try {
    const stored = localStorage.getItem('apex_cortex_settings');
    return stored ? { ...DEFAULTS, ...JSON.parse(stored) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

function saveSettings(settings) {
  localStorage.setItem('apex_cortex_settings', JSON.stringify(settings));
}

// ── Section Component ──────────────────────────────────────────────────────
function Section({ icon: Icon, title, children }) {
  return (
    <div className="panel-carbon p-4 sm:p-5">
      <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-neutral-800/60">
        <Icon className="w-4 h-4 text-amber-400" />
        <h3 className="font-orbitron text-xs sm:text-sm font-bold tracking-wider text-amber-400">
          {title}
        </h3>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

// ── Setting Row ──────────────────────────────────────────────────────────
function SettingRow({ label, desc, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
      <div className="flex-1 min-w-0">
        <div className="font-rajdhani text-sm sm:text-base text-neutral-300">{label}</div>
        {desc && <div className="font-mono-tech text-[10px] sm:text-xs text-neutral-600">{desc}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

// ── Select ───────────────────────────────────────────────────────────────
function Select({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-neutral-900 border border-neutral-700 rounded px-3 py-1.5 text-xs sm:text-sm font-mono-tech text-neutral-300
                 focus:border-amber-500/50 focus:outline-none transition-colors w-full sm:w-auto min-w-[140px]"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

// ── Number Input ──────────────────────────────────────────────────────────
function NumberInput({ value, onChange, min, max, step = 1, unit }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        className="bg-neutral-900 border border-neutral-700 rounded px-3 py-1.5 text-xs sm:text-sm font-mono-tech text-neutral-300
                   focus:border-amber-500/50 focus:outline-none transition-colors w-20 sm:w-24"
      />
      {unit && <span className="text-[10px] sm:text-xs font-mono-tech text-neutral-600">{unit}</span>}
    </div>
  );
}

// ── Toggle ───────────────────────────────────────────────────────────────
function Toggle({ value, onChange }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
        value ? 'bg-amber-500/30 border-amber-500/60' : 'bg-neutral-800 border-neutral-700'
      } border`}
    >
      <div
        className={`absolute top-0.5 w-4.5 h-4.5 rounded-full transition-all duration-200 ${
          value ? 'left-[22px] bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'left-0.5 bg-neutral-500'
        }`}
        style={{ width: '18px', height: '18px' }}
      />
    </button>
  );
}

// ── Text Input ──────────────────────────────────────────────────────────
function TextInput({ value, onChange, placeholder }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="bg-neutral-900 border border-neutral-700 rounded px-3 py-1.5 text-xs sm:text-sm font-mono-tech text-neutral-300
                 focus:border-amber-500/50 focus:outline-none transition-colors w-full sm:w-56 placeholder-neutral-700"
    />
  );
}

// ── Main Settings Page ──────────────────────────────────────────────────
export default function SettingsPage({ onBack }) {
  const [settings, setSettings] = useState(loadSettings);
  const [saved, setSaved] = useState(false);

  const update = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setSettings({ ...DEFAULTS });
    setSaved(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-4 py-3 border-b border-neutral-800/60 bg-neutral-950/95 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-neutral-500 hover:text-amber-400 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="font-mono-tech text-xs hidden sm:inline">BACK</span>
          </button>
          <div className="w-px h-5 bg-neutral-800" />
          <Zap className="w-5 h-5 text-amber-400" />
          <span className="font-orbitron text-sm font-bold tracking-[0.2em] text-amber-400">SETTINGS</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-neutral-700/50 bg-neutral-900/40
                       text-neutral-500 hover:text-neutral-300 hover:border-neutral-600 transition-all text-xs font-mono-tech"
          >
            <RotateCcw className="w-3 h-3" />
            <span className="hidden sm:inline">RESET</span>
          </button>
          <button
            onClick={handleSave}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded border font-orbitron text-xs font-bold tracking-wider transition-all duration-300
              ${saved
                ? 'border-green-500 bg-green-500/10 text-green-400'
                : 'border-amber-500 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
              }`}
          >
            {saved ? <Check className="w-3 h-3" /> : <Save className="w-3 h-3" />}
            {saved ? 'SAVED' : 'SAVE'}
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8 space-y-4 sm:space-y-5 pb-20">

        {/* ── Units ── */}
        <Section icon={Gauge} title="UNITS">
          <SettingRow label="Speed" desc="Dashboard speed display unit">
            <Select
              value={settings.units_speed}
              onChange={(v) => update('units_speed', v)}
              options={[
                { value: 'kmh', label: 'km/h' },
                { value: 'mph', label: 'mph' },
              ]}
            />
          </SettingRow>
          <SettingRow label="Temperature" desc="All temperature readings">
            <Select
              value={settings.units_temp}
              onChange={(v) => update('units_temp', v)}
              options={[
                { value: 'celsius', label: 'Celsius' },
                { value: 'fahrenheit', label: 'Fahrenheit' },
              ]}
            />
          </SettingRow>
          <SettingRow label="Pressure" desc="MAP, boost, barometric">
            <Select
              value={settings.units_pressure}
              onChange={(v) => update('units_pressure', v)}
              options={[
                { value: 'kpa', label: 'kPa' },
                { value: 'psi', label: 'PSI' },
                { value: 'bar', label: 'bar' },
              ]}
            />
          </SettingRow>
          <SettingRow label="Power" desc="Engine power output display">
            <Select
              value={settings.units_power}
              onChange={(v) => update('units_power', v)}
              options={[
                { value: 'kw', label: 'kW' },
                { value: 'hp', label: 'HP' },
                { value: 'ps', label: 'PS' },
              ]}
            />
          </SettingRow>
        </Section>

        {/* ── Connection ── */}
        <Section icon={Wifi} title="CONNECTION">
          <SettingRow label="Connection Type" desc="OBD-II adapter or simulator">
            <Select
              value={settings.connection_type}
              onChange={(v) => update('connection_type', v)}
              options={[
                { value: 'simulator', label: 'Simulator' },
                { value: 'bluetooth', label: 'Bluetooth' },
                { value: 'wifi', label: 'WiFi' },
                { value: 'usb', label: 'USB' },
              ]}
            />
          </SettingRow>
          {settings.connection_type !== 'simulator' && (
            <SettingRow label="Device Address" desc="Bluetooth MAC / WiFi IP:Port / USB Port">
              <TextInput
                value={settings.connection_address}
                onChange={(v) => update('connection_address', v)}
                placeholder={
                  settings.connection_type === 'bluetooth' ? 'AA:BB:CC:DD:EE:FF'
                    : settings.connection_type === 'wifi' ? '192.168.0.10:35000'
                    : '/dev/ttyUSB0'
                }
              />
            </SettingRow>
          )}
        </Section>

        {/* ── Polling Rates ── */}
        <Section icon={Database} title="POLLING RATES">
          <SettingRow label="Critical PIDs" desc="RPM, Speed, Throttle, Load">
            <NumberInput
              value={settings.poll_rate_critical}
              onChange={(v) => update('poll_rate_critical', v)}
              min={1} max={20} unit="Hz"
            />
          </SettingRow>
          <SettingRow label="Standard PIDs" desc="Coolant, MAP, IAT, MAF, O2, Oil">
            <NumberInput
              value={settings.poll_rate_standard}
              onChange={(v) => update('poll_rate_standard', v)}
              min={0.5} max={10} step={0.5} unit="Hz"
            />
          </SettingRow>
          <SettingRow label="Slow PIDs" desc="Fuel level, Baro, Battery, Ambient">
            <NumberInput
              value={settings.poll_rate_slow}
              onChange={(v) => update('poll_rate_slow', v)}
              min={0.1} max={2} step={0.1} unit="Hz"
            />
          </SettingRow>
        </Section>

        {/* ── Alerts ── */}
        <Section icon={Bell} title="ALERTS">
          <SettingRow label="Enable Alerts" desc="Show warning overlays on critical values">
            <Toggle value={settings.alerts_enabled} onChange={(v) => update('alerts_enabled', v)} />
          </SettingRow>
          <SettingRow label="Coolant Max" desc="Warning when coolant exceeds">
            <NumberInput
              value={settings.alert_coolant_max}
              onChange={(v) => update('alert_coolant_max', v)}
              min={80} max={150} unit="°C"
            />
          </SettingRow>
          <SettingRow label="Oil Max" desc="Warning when oil temp exceeds">
            <NumberInput
              value={settings.alert_oil_max}
              onChange={(v) => update('alert_oil_max', v)}
              min={90} max={170} unit="°C"
            />
          </SettingRow>
          <SettingRow label="RPM Max" desc="Redline warning threshold">
            <NumberInput
              value={settings.alert_rpm_max}
              onChange={(v) => update('alert_rpm_max', v)}
              min={3000} max={12000} step={100} unit="RPM"
            />
          </SettingRow>
          <SettingRow label="Fuel Min" desc="Low fuel warning threshold">
            <NumberInput
              value={settings.alert_fuel_min}
              onChange={(v) => update('alert_fuel_min', v)}
              min={2} max={30} unit="%"
            />
          </SettingRow>
        </Section>

        {/* ── Display ── */}
        <Section icon={Monitor} title="DISPLAY">
          <SettingRow label="Target FPS" desc="Dashboard refresh rate">
            <Select
              value={String(settings.display_fps)}
              onChange={(v) => update('display_fps', Number(v))}
              options={[
                { value: '30', label: '30 FPS' },
                { value: '60', label: '60 FPS' },
              ]}
            />
          </SettingRow>
          <SettingRow label="Data Smoothing" desc="Smooth gauge animations">
            <Toggle value={settings.smoothing_enabled} onChange={(v) => update('smoothing_enabled', v)} />
          </SettingRow>
        </Section>

        {/* ── Theme ── */}
        <Section icon={Palette} title="APPEARANCE">
          <SettingRow label="Theme" desc="Dashboard color theme">
            <Select
              value={settings.theme}
              onChange={(v) => update('theme', v)}
              options={[
                { value: 'carbon', label: 'Carbon Dark' },
                { value: 'midnight', label: 'Midnight Blue' },
                { value: 'stealth', label: 'Stealth Black' },
              ]}
            />
          </SettingRow>
          <SettingRow label="Accent Color" desc="Primary highlight color">
            <Select
              value={settings.accent_color}
              onChange={(v) => update('accent_color', v)}
              options={[
                { value: 'amber', label: 'Amber (Default)' },
                { value: 'red', label: 'Racing Red' },
                { value: 'green', label: 'Lime Green' },
                { value: 'blue', label: 'Electric Blue' },
                { value: 'purple', label: 'Ultraviolet' },
              ]}
            />
          </SettingRow>
        </Section>

        {/* ── Session Recording ── */}
        <Section icon={Database} title="SESSION RECORDING">
          <SettingRow label="Auto Record" desc="Automatically start recording on connect">
            <Toggle value={settings.session_auto_record} onChange={(v) => update('session_auto_record', v)} />
          </SettingRow>
          <SettingRow label="Export Format" desc="Session data export format">
            <Select
              value={settings.session_format}
              onChange={(v) => update('session_format', v)}
              options={[
                { value: 'json', label: 'JSON' },
                { value: 'csv', label: 'CSV' },
              ]}
            />
          </SettingRow>
        </Section>

      </div>
    </div>
  );
}
