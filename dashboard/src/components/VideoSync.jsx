/**
 * VideoSync — Nürburgring onboard video synced to simulator lap time.
 *
 * Default: YouTube embed of the Porsche 919 Evo record lap.
 * Auto-plays when demo mode starts, syncs playback to lap_time.
 * Also supports local video files (drag & drop).
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Film, Upload, X, Volume2, VolumeX, Maximize2, Minimize2, RotateCcw } from 'lucide-react';

// Default: Porsche 919 Evo Nürburgring record lap onboard
const DEFAULT_YT_ID = 'PQmSUHhP3ug';
const DEFAULT_VIDEO_OFFSET = 0;

export default function VideoSync({
  lapTimeMs = 0,
  isRunning = false,
  isDemo = false,
  className = '',
}) {
  const videoRef = useRef(null);
  const ytPlayerRef = useRef(null);
  const containerRef = useRef(null);
  // Auto-load YouTube video on mount
  const [videoSource, setVideoSource] = useState({ type: 'youtube', ytId: DEFAULT_YT_ID });
  const [muted, setMuted] = useState(true); // Start muted (browser autoplay policy)
  const [expanded, setExpanded] = useState(false);
  const [showDropzone, setShowDropzone] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [videoOffset, setVideoOffset] = useState(DEFAULT_VIDEO_OFFSET);
  const [syncActive, setSyncActive] = useState(true);
  const [ytReady, setYtReady] = useState(false);
  const lastSyncRef = useRef(0);
  const iframeKeyRef = useRef(0);
  const hasUserInteracted = useRef(false);

  // Track user interaction for unmuting
  useEffect(() => {
    const handler = () => { hasUserInteracted.current = true; };
    window.addEventListener('click', handler, { once: true });
    window.addEventListener('keydown', handler, { once: true });
    return () => {
      window.removeEventListener('click', handler);
      window.removeEventListener('keydown', handler);
    };
  }, []);

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

  // ── File Drop / Pick ───────────────────────────────────────────────────
  const handleFile = useCallback((file) => {
    if (!file || !file.type.startsWith('video/')) return;
    const url = URL.createObjectURL(file);
    setVideoSource({ type: 'file', url, name: file.name });
    setShowDropzone(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    handleFile(e.dataTransfer?.files?.[0]);
  }, [handleFile]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // ── HTML5 Video Play/Pause ────────────────────────────────────────────
  useEffect(() => {
    if (!videoSource || videoSource.type === 'youtube') return;
    const video = videoRef.current;
    if (!video) return;
    if (isRunning && isDemo) {
      video.play().catch(() => {});
    } else {
      video.pause();
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

  // ── Sync playback position with lap time ──────────────────────────────
  useEffect(() => {
    if (!videoSource || !syncActive) return;
    const targetTime = (lapTimeMs / 1000) + videoOffset;
    const now = performance.now();

    // HTML5 video
    if (videoSource.type !== 'youtube' && videoRef.current) {
      const video = videoRef.current;
      const drift = Math.abs(video.currentTime - targetTime);
      if (drift > 0.8 && now - lastSyncRef.current > 500) {
        video.currentTime = Math.max(0, targetTime);
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

  // ── Reset to default video ────────────────────────────────────────────
  const resetToDefault = useCallback(() => {
    if (videoSource?.type === 'file' && videoSource.url) {
      URL.revokeObjectURL(videoSource.url);
    }
    setVideoSource({ type: 'youtube', ytId: DEFAULT_YT_ID });
    iframeKeyRef.current++;
    setShowDropzone(false);
  }, [videoSource]);

  // ── Remove video completely ───────────────────────────────────────────
  const removeVideo = useCallback(() => {
    if (videoSource?.type === 'file' && videoSource.url) {
      URL.revokeObjectURL(videoSource.url);
    }
    setVideoSource(null);
  }, [videoSource]);

  // ── Render: No video ──────────────────────────────────────────────────
  const containerClass = expanded
    ? 'fixed inset-0 z-[100] bg-black/95 flex items-center justify-center'
    : `relative ${className}`;

  if (!videoSource) {
    return (
      <div className={`panel-carbon ${className}`}>
        {showDropzone ? (
          <div
            className="h-full flex flex-col items-center justify-center p-4 gap-3 border-2 border-dashed border-amber-500/30 rounded-lg cursor-pointer"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => {
              const inp = document.createElement('input');
              inp.type = 'file'; inp.accept = 'video/*';
              inp.onchange = (e) => handleFile(e.target.files?.[0]);
              inp.click();
            }}
          >
            <Upload className="w-8 h-8 text-amber-400/60" />
            <span className="font-mono-tech text-xs text-amber-400/80 text-center">
              Drop onboard video here<br />or click to browse
            </span>
            <div className="w-full mt-2">
              <div className="flex items-center gap-1 text-neutral-600 text-[10px] font-mono-tech mb-1.5 justify-center">
                — OR PASTE URL —
              </div>
              <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
                  placeholder="YouTube URL or video URL"
                  className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-[10px] font-mono-tech text-neutral-300 placeholder-neutral-600 outline-none focus:border-amber-500/50"
                />
                <button onClick={handleUrlSubmit}
                  className="px-2 py-1 bg-amber-500/20 border border-amber-500/40 rounded text-[10px] font-mono-tech text-amber-400 hover:bg-amber-500/30">
                  LOAD
                </button>
              </div>
            </div>
            <div className="flex gap-2 mt-2">
              <button
                onClick={(e) => { e.stopPropagation(); resetToDefault(); }}
                className="flex items-center gap-1 text-[10px] font-mono-tech text-amber-400/80 hover:text-amber-400 px-2 py-1 bg-amber-500/10 rounded border border-amber-500/20"
              >
                <RotateCcw className="w-3 h-3" /> DEFAULT VIDEO
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setShowDropzone(false); }}
                className="text-[10px] font-mono-tech text-neutral-600 hover:text-neutral-400 px-2 py-1"
              >
                CANCEL
              </button>
            </div>
          </div>
        ) : (
          <div className="h-full w-full flex flex-col items-center justify-center gap-3 p-4">
            <button
              onClick={resetToDefault}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg
                         font-mono-tech text-xs text-amber-400 hover:bg-amber-500/20 transition-all group"
            >
              <Film className="w-4 h-4 group-hover:scale-110 transition-transform" />
              LOAD ONBOARD VIDEO
            </button>
            <button
              onClick={() => setShowDropzone(true)}
              className="font-mono-tech text-[9px] text-neutral-600 hover:text-neutral-400 transition-colors"
            >
              or load custom video
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Render: Video loaded ──────────────────────────────────────────────
  // Build YouTube embed URL with autoplay + mute for browser policy
  const ytEmbedUrl = videoSource.type === 'youtube'
    ? `https://www.youtube-nocookie.com/embed/${videoSource.ytId}?enablejsapi=1&autoplay=1&mute=${muted ? 1 : 0}&controls=0&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&playsinline=1&loop=1&playlist=${videoSource.ytId}`
    : null;

  return (
    <div className={containerClass} ref={containerRef}>
      <div className={`relative ${expanded ? 'w-full max-w-6xl aspect-video' : 'w-full h-full'} bg-black rounded-lg overflow-hidden`}>
        {/* Video Element */}
        {videoSource.type === 'youtube' ? (
          <iframe
            key={iframeKeyRef.current}
            ref={ytPlayerRef}
            src={ytEmbedUrl}
            className="absolute inset-0 w-full h-full"
            allow="autoplay; encrypted-media"
            allowFullScreen
            frameBorder="0"
            title="Nürburgring Onboard"
          />
        ) : (
          <video
            ref={videoRef}
            src={videoSource.url}
            className="absolute inset-0 w-full h-full object-contain"
            muted={muted}
            playsInline
            preload="auto"
            loop
          />
        )}

        {/* Controls Overlay (visible on hover) */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 sm:p-3
                        flex items-end justify-between opacity-0 hover:opacity-100 transition-opacity duration-300">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            {/* Unmute button — prominent when muted */}
            <button
              onClick={() => {
                const next = !muted;
                setMuted(next);
                if (videoRef.current) videoRef.current.muted = next;
              }}
              className={`flex items-center gap-1 px-2 py-1 rounded transition-all ${
                muted
                  ? 'bg-amber-500/20 border border-amber-500/40 text-amber-400 hover:bg-amber-500/30'
                  : 'hover:bg-white/10 text-white/80'
              }`}
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              {muted && <span className="text-[9px] font-mono-tech hidden sm:inline">UNMUTE</span>}
            </button>

            {/* Sync indicator */}
            <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-mono-tech ${
              syncActive ? 'bg-green-500/20 text-green-400' : 'bg-neutral-700/50 text-neutral-500'
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${syncActive ? 'bg-green-400 animate-pulse' : 'bg-neutral-600'}`} />
              {syncActive ? 'SYNC' : 'FREE'}
            </div>

            <button onClick={() => setSyncActive(!syncActive)}
              className="text-[8px] font-mono-tech text-neutral-500 hover:text-white/80 px-1">
              {syncActive ? 'UNLOCK' : 'LOCK'}
            </button>

            {/* Offset controls */}
            <div className="hidden sm:flex items-center gap-1">
              <button onClick={() => setVideoOffset(o => o - 0.5)}
                className="text-[10px] font-mono-tech text-neutral-500 hover:text-white/80 px-1">-0.5s</button>
              <span className="text-[8px] font-mono-tech text-neutral-600">OFF:{videoOffset.toFixed(1)}s</span>
              <button onClick={() => setVideoOffset(o => o + 0.5)}
                className="text-[10px] font-mono-tech text-neutral-500 hover:text-white/80 px-1">+0.5s</button>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Expand */}
            <button onClick={() => setExpanded(!expanded)}
              className="p-1 rounded hover:bg-white/10 text-white/80 transition-colors">
              {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            {/* Switch video */}
            <button onClick={() => { removeVideo(); setShowDropzone(true); }}
              className="p-1 rounded hover:bg-white/10 text-white/60 transition-colors" title="Change video">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            {/* Remove */}
            <button onClick={removeVideo}
              className="p-1 rounded hover:bg-red-500/20 text-white/60 hover:text-red-400 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mute hint overlay (only when muted, fades away) */}
        {muted && videoSource.type === 'youtube' && (
          <button
            onClick={() => setMuted(false)}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                       flex items-center gap-2 px-4 py-2 bg-black/60 border border-amber-500/40 rounded-lg
                       text-amber-400 font-mono-tech text-xs hover:bg-black/80 transition-all
                       animate-pulse backdrop-blur-sm cursor-pointer z-10"
          >
            <Volume2 className="w-5 h-5" />
            CLICK FOR SOUND
          </button>
        )}

        {/* Lap time overlay */}
        <div className="absolute top-2 right-2 px-2 py-1 bg-black/70 rounded text-amber-400 font-orbitron text-[10px] sm:text-xs font-bold backdrop-blur-sm">
          {Math.floor(lapTimeMs / 60000)}:{String(Math.floor((lapTimeMs % 60000) / 1000)).padStart(2, '0')}.{String(Math.floor(lapTimeMs % 1000)).padStart(3, '0')}
        </div>

        {/* Section name overlay */}
        <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 rounded text-neutral-400 font-mono-tech text-[9px] backdrop-blur-sm">
          NORDSCHLEIFE ONBOARD
        </div>
      </div>

      {/* Expanded backdrop close */}
      {expanded && (
        <button
          className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
          onClick={() => setExpanded(false)}
        >
          <X className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}
