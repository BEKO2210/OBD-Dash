/**
 * VideoSync — Audio-only engine sound from Nürburgring onboard video.
 *
 * The YouTube iframe is kept in the DOM (hidden) so audio still plays.
 * Playback rate is tied to RPM — higher RPM = higher pitched engine sound.
 * Playback position is synced to simulator lap time.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Volume2, VolumeX, Music, RotateCcw, Upload, X } from 'lucide-react';

// Default: Porsche 919 Evo Nürburgring record lap onboard
const DEFAULT_YT_ID = 'PQmSUHhP3ug';
const DEFAULT_VIDEO_OFFSET = 5; // Original video has 5s intro before lap starts

// 919 Evo RPM range for playback rate mapping
const RPM_MIN = 3000;   // Below this → minimum rate
const RPM_MID = 7000;   // Reference RPM (original recording) → rate 1.0
const RPM_MAX = 9200;   // Redline → maximum rate
const RATE_MIN = 0.6;   // Playback rate at low RPM
const RATE_MAX = 1.4;   // Playback rate at redline

// YouTube only supports these discrete rates
const YT_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

function rpmToRate(rpm) {
  if (!rpm || rpm < RPM_MIN) return RATE_MIN;
  if (rpm > RPM_MAX) return RATE_MAX;
  // Linear interpolation: RPM_MIN→RATE_MIN, RPM_MID→1.0, RPM_MAX→RATE_MAX
  if (rpm <= RPM_MID) {
    return RATE_MIN + ((rpm - RPM_MIN) / (RPM_MID - RPM_MIN)) * (1.0 - RATE_MIN);
  }
  return 1.0 + ((rpm - RPM_MID) / (RPM_MAX - RPM_MID)) * (RATE_MAX - 1.0);
}

function nearestYtRate(rate) {
  let best = 1;
  let bestDiff = Infinity;
  for (const r of YT_RATES) {
    const d = Math.abs(r - rate);
    if (d < bestDiff) { bestDiff = d; best = r; }
  }
  return best;
}

export default function VideoSync({
  lapTimeMs = 0,
  rpm = 0,
  speed = 0,
  isRunning = false,
  isDemo = false,
  className = '',
}) {
  const videoRef = useRef(null);
  const ytPlayerRef = useRef(null);
  const [videoSource, setVideoSource] = useState({ type: 'youtube', ytId: DEFAULT_YT_ID });
  const [muted, setMuted] = useState(true);
  const [showDropzone, setShowDropzone] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [videoOffset, setVideoOffset] = useState(DEFAULT_VIDEO_OFFSET);
  const [syncActive, setSyncActive] = useState(true);
  const lastSyncRef = useRef(0);
  const lastRateRef = useRef(1);
  const iframeKeyRef = useRef(0);

  // ── YouTube ID Extraction ──────────────────────────────────────────────
  const extractYouTubeId = useCallback((url) => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      /^([a-zA-Z0-9_-]{11})$/,
    ];
    for (const p of patterns) {
      const m = url.match(p);
      if (m) return m[1];
    }
    return null;
  }, []);

  // ── Load custom URL ───────────────────────────────────────────────────
  const handleUrlSubmit = useCallback(() => {
    if (!urlInput.trim()) return;
    const ytId = extractYouTubeId(urlInput.trim());
    if (ytId) {
      setVideoSource({ type: 'youtube', ytId });
      iframeKeyRef.current++;
    } else {
      setVideoSource({ type: 'url', url: urlInput.trim() });
    }
    setUrlInput('');
    setShowDropzone(false);
  }, [urlInput, extractYouTubeId]);

  // ── File Pick ────────────────────────────────────────────────────────
  const handleFile = useCallback((file) => {
    if (!file || (!file.type.startsWith('video/') && !file.type.startsWith('audio/'))) return;
    const url = URL.createObjectURL(file);
    setVideoSource({ type: 'file', url, name: file.name });
    setShowDropzone(false);
  }, []);

  // ── HTML5 Video/Audio Play/Pause ────────────────────────────────────
  useEffect(() => {
    if (!videoSource || videoSource.type === 'youtube') return;
    const el = videoRef.current;
    if (!el) return;
    if (isRunning && isDemo) {
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  }, [isRunning, isDemo, videoSource]);

  // ── YouTube postMessage commands ──────────────────────────────────────
  const ytCommand = useCallback((func, args = []) => {
    if (!ytPlayerRef.current?.contentWindow) return;
    try {
      ytPlayerRef.current.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func, args }),
        '*'
      );
    } catch (e) { /* cross-origin, ignore */ }
  }, []);

  // YouTube play/pause sync
  useEffect(() => {
    if (!videoSource || videoSource.type !== 'youtube') return;
    if (isRunning && isDemo) {
      ytCommand('playVideo');
    } else {
      ytCommand('pauseVideo');
    }
  }, [isRunning, isDemo, videoSource, ytCommand]);

  // YouTube mute sync
  useEffect(() => {
    if (!videoSource || videoSource.type !== 'youtube') return;
    ytCommand(muted ? 'mute' : 'unMute');
  }, [muted, videoSource, ytCommand]);

  // ── RPM → Playback Rate (engine sound pitch) ──────────────────────────
  useEffect(() => {
    if (!videoSource || !isRunning || !isDemo) return;
    const targetRate = rpmToRate(rpm);

    // HTML5 video/audio — smooth continuous rate
    if (videoSource.type !== 'youtube' && videoRef.current) {
      // Smooth transition: move 30% toward target each tick
      const current = videoRef.current.playbackRate || 1;
      const smoothed = current + (targetRate - current) * 0.3;
      const clamped = Math.max(0.5, Math.min(2.0, smoothed));
      videoRef.current.playbackRate = clamped;
    }

    // YouTube — discrete rates, only change when bucket changes
    if (videoSource.type === 'youtube') {
      const ytRate = nearestYtRate(targetRate);
      if (ytRate !== lastRateRef.current) {
        ytCommand('setPlaybackRate', [ytRate]);
        lastRateRef.current = ytRate;
      }
    }
  }, [rpm, videoSource, isRunning, isDemo, ytCommand]);

  // ── Sync playback position with lap time ──────────────────────────────
  useEffect(() => {
    if (!videoSource || !syncActive) return;
    const targetTime = (lapTimeMs / 1000) + videoOffset;
    const now = performance.now();

    // HTML5 video/audio
    if (videoSource.type !== 'youtube' && videoRef.current) {
      const el = videoRef.current;
      const drift = Math.abs(el.currentTime - targetTime);
      if (drift > 0.8 && now - lastSyncRef.current > 500) {
        el.currentTime = Math.max(0, targetTime);
        lastSyncRef.current = now;
      }
    }

    // YouTube
    if (videoSource.type === 'youtube') {
      const drift = Math.abs((ytPlayerRef.current?._lastTime || 0) - targetTime);
      if (drift > 2.0 && now - lastSyncRef.current > 1500) {
        ytCommand('seekTo', [Math.max(0, targetTime), true]);
        if (ytPlayerRef.current) ytPlayerRef.current._lastTime = targetTime;
        lastSyncRef.current = now;
      }
    }
  }, [lapTimeMs, videoSource, videoOffset, syncActive, ytCommand]);

  // Cleanup object URLs
  useEffect(() => {
    return () => {
      if (videoSource?.type === 'file' && videoSource.url) {
        URL.revokeObjectURL(videoSource.url);
      }
    };
  }, [videoSource]);

  // ── Reset to default ────────────────────────────────────────────────
  const resetToDefault = useCallback(() => {
    if (videoSource?.type === 'file' && videoSource.url) {
      URL.revokeObjectURL(videoSource.url);
    }
    setVideoSource({ type: 'youtube', ytId: DEFAULT_YT_ID });
    iframeKeyRef.current++;
    setShowDropzone(false);
  }, [videoSource]);

  // ── Remove completely ───────────────────────────────────────────────
  const removeVideo = useCallback(() => {
    if (videoSource?.type === 'file' && videoSource.url) {
      URL.revokeObjectURL(videoSource.url);
    }
    setVideoSource(null);
  }, [videoSource]);

  // Build YouTube embed URL
  const ytEmbedUrl = videoSource?.type === 'youtube'
    ? `https://www.youtube-nocookie.com/embed/${videoSource.ytId}?enablejsapi=1&autoplay=1&mute=${muted ? 1 : 0}&controls=0&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&playsinline=1&loop=1&playlist=${videoSource.ytId}`
    : null;

  // Current playback rate for display
  const currentRate = rpmToRate(rpm);

  // ── Render: No source loaded ────────────────────────────────────────
  if (!videoSource) {
    return (
      <div className={`${className}`}>
        {showDropzone ? (
          <div className="flex items-center gap-2 p-2 bg-neutral-900/80 border border-neutral-800 rounded-lg">
            <div className="flex gap-1.5 flex-1" onClick={(e) => e.stopPropagation()}>
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
                placeholder="YouTube URL or audio/video URL"
                className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-[10px] font-mono-tech text-neutral-300 placeholder-neutral-600 outline-none focus:border-amber-500/50"
              />
              <button onClick={handleUrlSubmit}
                className="px-2 py-1 bg-amber-500/20 border border-amber-500/40 rounded text-[10px] font-mono-tech text-amber-400 hover:bg-amber-500/30">
                LOAD
              </button>
            </div>
            <button onClick={() => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'video/*,audio/*'; inp.onchange = (e) => handleFile(e.target.files?.[0]); inp.click(); }}
              className="p-1 rounded hover:bg-white/10 text-neutral-500 hover:text-amber-400 transition-colors" title="Browse file">
              <Upload className="w-3.5 h-3.5" />
            </button>
            <button onClick={resetToDefault}
              className="flex items-center gap-1 px-2 py-1 bg-amber-500/10 rounded border border-amber-500/20 text-[9px] font-mono-tech text-amber-400/80 hover:text-amber-400">
              <RotateCcw className="w-3 h-3" /> DEFAULT
            </button>
            <button onClick={() => setShowDropzone(false)}
              className="p-1 rounded hover:bg-white/10 text-neutral-600 hover:text-neutral-400 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={resetToDefault}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg
                         font-mono-tech text-[10px] text-amber-400 hover:bg-amber-500/20 transition-all"
            >
              <Music className="w-3.5 h-3.5" />
              ENGINE SOUND
            </button>
            <button
              onClick={() => setShowDropzone(true)}
              className="font-mono-tech text-[8px] text-neutral-600 hover:text-neutral-400 transition-colors"
            >
              custom audio
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Render: Audio control bar ───────────────────────────────────────
  return (
    <div className={`${className}`}>
      {/* Hidden YouTube iframe — must stay in DOM for audio playback */}
      {videoSource.type === 'youtube' && (
        <iframe
          key={iframeKeyRef.current}
          ref={ytPlayerRef}
          src={ytEmbedUrl}
          className="absolute"
          style={{ width: 1, height: 1, opacity: 0, pointerEvents: 'none', position: 'absolute', top: -9999, left: -9999 }}
          allow="autoplay; encrypted-media"
          frameBorder="0"
          title="Nürburgring Engine Sound"
        />
      )}

      {/* Hidden HTML5 audio/video element for local files */}
      {videoSource.type !== 'youtube' && (
        <video
          ref={videoRef}
          src={videoSource.url}
          className="hidden"
          muted={muted}
          playsInline
          preload="auto"
          loop
        />
      )}

      {/* Compact audio control bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-900/60 border border-neutral-800/50 rounded-lg backdrop-blur-sm">
        {/* Sound icon + waveform indicator */}
        <div className="flex items-center gap-1.5">
          <Music className="w-3.5 h-3.5 text-amber-500/60" />
          {!muted && isRunning && isDemo && (
            <div className="flex items-end gap-[2px] h-3">
              {[0.6, 1, 0.4, 0.8, 0.5].map((h, i) => (
                <div
                  key={i}
                  className="w-[2px] bg-amber-500/60 rounded-full"
                  style={{
                    height: `${h * 100}%`,
                    animation: `audioBar ${0.15 + (1.1 - currentRate) * 0.3}s ease-in-out infinite alternate`,
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* RPM-linked rate indicator */}
        {isRunning && isDemo && rpm > 0 && (
          <div className="hidden sm:flex items-center gap-1.5">
            <span className="font-mono-tech text-[8px] text-neutral-600">
              {Math.round(rpm)} RPM
            </span>
            <div className="w-12 h-1 bg-neutral-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-150"
                style={{
                  width: `${Math.min(100, ((rpm - RPM_MIN) / (RPM_MAX - RPM_MIN)) * 100)}%`,
                  backgroundColor: rpm > 8500 ? '#ef4444' : rpm > 7000 ? '#f59e0b' : '#22c55e',
                }}
              />
            </div>
            <span className="font-mono-tech text-[7px] text-neutral-600">
              ×{currentRate.toFixed(2)}
            </span>
          </div>
        )}

        {/* Speed indicator */}
        {isRunning && isDemo && speed > 0 && (
          <span className="font-mono-tech text-[8px] text-neutral-500 hidden sm:inline">
            {Math.round(speed)} km/h
          </span>
        )}

        {/* Label */}
        <span className="font-mono-tech text-[9px] text-neutral-500 hidden lg:inline">
          {videoSource.type === 'youtube' ? '919 EVO' : videoSource.name || 'AUDIO'}
        </span>

        {/* Mute/Unmute */}
        <button
          onClick={() => {
            const next = !muted;
            setMuted(next);
            if (videoRef.current) videoRef.current.muted = next;
          }}
          className={`flex items-center gap-1 px-2 py-0.5 rounded transition-all text-[9px] font-mono-tech ${
            muted
              ? 'bg-amber-500/20 border border-amber-500/40 text-amber-400 hover:bg-amber-500/30 animate-pulse'
              : 'hover:bg-white/10 text-green-400/80'
          }`}
        >
          {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          {muted ? 'UNMUTE' : 'ON'}
        </button>

        {/* Sync indicator */}
        <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[7px] font-mono-tech ${
          syncActive ? 'text-green-400/60' : 'text-neutral-600'
        }`}>
          <div className={`w-1 h-1 rounded-full ${syncActive ? 'bg-green-400 animate-pulse' : 'bg-neutral-700'}`} />
          {syncActive ? 'SYNC' : 'FREE'}
        </div>

        {/* Offset */}
        <div className="hidden sm:flex items-center gap-0.5">
          <button onClick={() => setVideoOffset(o => o - 0.5)}
            className="text-[9px] font-mono-tech text-neutral-600 hover:text-white/80 px-0.5">−</button>
          <span className="text-[7px] font-mono-tech text-neutral-600 min-w-[28px] text-center">{videoOffset.toFixed(1)}s</span>
          <button onClick={() => setVideoOffset(o => o + 0.5)}
            className="text-[9px] font-mono-tech text-neutral-600 hover:text-white/80 px-0.5">+</button>
        </div>

        {/* Change / Remove */}
        <button onClick={() => { removeVideo(); setShowDropzone(true); }}
          className="p-0.5 rounded hover:bg-white/10 text-neutral-600 hover:text-neutral-400 transition-colors ml-auto" title="Change audio">
          <RotateCcw className="w-3 h-3" />
        </button>
        <button onClick={removeVideo}
          className="p-0.5 rounded hover:bg-red-500/20 text-neutral-600 hover:text-red-400 transition-colors" title="Remove">
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* CSS animation for waveform bars */}
      <style>{`
        @keyframes audioBar {
          0% { transform: scaleY(0.3); }
          100% { transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
}
