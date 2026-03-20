/**
 * VideoSync — Syncs a video with the Nürburgring simulator lap time.
 *
 * Supports:
 * - Local video file (drag & drop or file picker) — perfect frame sync
 * - YouTube embed via IFrame API — approximate sync
 *
 * The 919 Evo record lap is 5:19.546 (319.546s).
 * The simulator's lap_time (ms) maps directly to video.currentTime (s).
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Film, Upload, X, Volume2, VolumeX, Maximize2, Minimize2 } from 'lucide-react';

// Offset in seconds to fine-tune video start (some videos have intro)
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
  const [videoSource, setVideoSource] = useState(null); // { type: 'file'|'youtube', url, ytId }
  const [muted, setMuted] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showDropzone, setShowDropzone] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [videoOffset, setVideoOffset] = useState(DEFAULT_VIDEO_OFFSET);
  const [syncActive, setSyncActive] = useState(true);
  const lastSyncRef = useRef(0);

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

  // ── Load URL ───────────────────────────────────────────────────────────
  const handleUrlSubmit = useCallback(() => {
    if (!urlInput.trim()) return;
    const ytId = extractYouTubeId(urlInput.trim());
    if (ytId) {
      setVideoSource({ type: 'youtube', ytId });
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
    const file = e.dataTransfer?.files?.[0];
    handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // ── HTML5 Video Sync ──────────────────────────────────────────────────
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

  // Sync video position with lap time (throttled to avoid stuttering)
  useEffect(() => {
    if (!videoSource || !syncActive) return;

    const targetTime = (lapTimeMs / 1000) + videoOffset;
    const now = performance.now();

    // HTML5 video sync
    if (videoSource.type !== 'youtube' && videoRef.current) {
      const video = videoRef.current;
      const drift = Math.abs(video.currentTime - targetTime);

      // Only seek if drift exceeds threshold (avoids constant seeking)
      if (drift > 0.8 && now - lastSyncRef.current > 500) {
        video.currentTime = targetTime;
        lastSyncRef.current = now;
      }
    }

    // YouTube sync via postMessage
    if (videoSource.type === 'youtube' && ytPlayerRef.current) {
      const drift = Math.abs((ytPlayerRef.current._lastTime || 0) - targetTime);
      if (drift > 1.5 && now - lastSyncRef.current > 1000) {
        ytPlayerRef.current.contentWindow?.postMessage(
          JSON.stringify({ event: 'command', func: 'seekTo', args: [targetTime, true] }),
          '*'
        );
        ytPlayerRef.current._lastTime = targetTime;
        lastSyncRef.current = now;
      }
    }
  }, [lapTimeMs, videoSource, videoOffset, syncActive]);

  // YouTube play/pause
  useEffect(() => {
    if (!videoSource || videoSource.type !== 'youtube' || !ytPlayerRef.current) return;
    const cmd = isRunning && isDemo ? 'playVideo' : 'pauseVideo';
    ytPlayerRef.current.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func: cmd, args: [] }),
      '*'
    );
  }, [isRunning, isDemo, videoSource]);

  // Cleanup object URLs
  useEffect(() => {
    return () => {
      if (videoSource?.type === 'file' && videoSource.url) {
        URL.revokeObjectURL(videoSource.url);
      }
    };
  }, [videoSource]);

  // ── Remove Video ──────────────────────────────────────────────────────
  const removeVideo = useCallback(() => {
    if (videoSource?.type === 'file' && videoSource.url) {
      URL.revokeObjectURL(videoSource.url);
    }
    setVideoSource(null);
  }, [videoSource]);

  // ── Render ────────────────────────────────────────────────────────────
  const containerClass = expanded
    ? 'fixed inset-0 z-[100] bg-black/95 flex items-center justify-center'
    : `relative ${className}`;

  // No video loaded — show dropzone/prompt
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
              inp.type = 'file';
              inp.accept = 'video/*';
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
                <button
                  onClick={handleUrlSubmit}
                  className="px-2 py-1 bg-amber-500/20 border border-amber-500/40 rounded text-[10px] font-mono-tech text-amber-400 hover:bg-amber-500/30"
                >
                  LOAD
                </button>
              </div>
            </div>

            <button
              onClick={(e) => { e.stopPropagation(); setShowDropzone(false); }}
              className="text-[10px] font-mono-tech text-neutral-600 hover:text-neutral-400 mt-1"
            >
              CANCEL
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowDropzone(true)}
            className="h-full w-full flex flex-col items-center justify-center gap-2 p-4 hover:bg-amber-500/5 transition-colors rounded-lg group"
          >
            <Film className="w-6 h-6 text-neutral-600 group-hover:text-amber-400/60 transition-colors" />
            <span className="font-mono-tech text-[10px] text-neutral-600 group-hover:text-neutral-400 tracking-wider transition-colors">
              LOAD ONBOARD VIDEO
            </span>
            <span className="font-mono-tech text-[8px] text-neutral-700">
              Syncs with lap simulation
            </span>
          </button>
        )}
      </div>
    );
  }

  // Video loaded
  return (
    <div className={containerClass} ref={containerRef}>
      <div className={`relative ${expanded ? 'w-full max-w-6xl aspect-video' : 'w-full h-full'} bg-black rounded-lg overflow-hidden`}>
        {/* Video Element */}
        {videoSource.type === 'youtube' ? (
          <iframe
            ref={ytPlayerRef}
            src={`https://www.youtube-nocookie.com/embed/${videoSource.ytId}?enablejsapi=1&autoplay=${isRunning && isDemo ? 1 : 0}&mute=${muted ? 1 : 0}&controls=0&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&playsinline=1&start=${Math.floor(videoOffset)}`}
            className="absolute inset-0 w-full h-full"
            allow="autoplay; encrypted-media"
            allowFullScreen
            frameBorder="0"
          />
        ) : (
          <video
            ref={videoRef}
            src={videoSource.url}
            className="absolute inset-0 w-full h-full object-contain"
            muted={muted}
            playsInline
            preload="auto"
          />
        )}

        {/* Controls Overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 flex items-end justify-between opacity-0 hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-2">
            {/* Mute toggle */}
            <button
              onClick={() => {
                setMuted(!muted);
                if (videoRef.current) videoRef.current.muted = !muted;
              }}
              className="p-1 rounded hover:bg-white/10 text-white/80 transition-colors"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {/* Sync indicator */}
            <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-mono-tech ${
              syncActive ? 'bg-green-500/20 text-green-400' : 'bg-neutral-700/50 text-neutral-500'
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${syncActive ? 'bg-green-400 animate-pulse' : 'bg-neutral-600'}`} />
              {syncActive ? 'SYNC' : 'FREE'}
            </div>

            {/* Sync toggle */}
            <button
              onClick={() => setSyncActive(!syncActive)}
              className="text-[8px] font-mono-tech text-neutral-500 hover:text-white/80 px-1"
            >
              {syncActive ? 'UNLOCK' : 'LOCK'}
            </button>

            {/* Offset control */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setVideoOffset(o => o - 0.5)}
                className="text-[10px] font-mono-tech text-neutral-500 hover:text-white/80 px-1"
              >
                -0.5s
              </button>
              <span className="text-[8px] font-mono-tech text-neutral-600">
                OFF:{videoOffset.toFixed(1)}s
              </span>
              <button
                onClick={() => setVideoOffset(o => o + 0.5)}
                className="text-[10px] font-mono-tech text-neutral-500 hover:text-white/80 px-1"
              >
                +0.5s
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Expand/Collapse */}
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1 rounded hover:bg-white/10 text-white/80 transition-colors"
            >
              {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Remove */}
            <button
              onClick={removeVideo}
              className="p-1 rounded hover:bg-red-500/20 text-white/60 hover:text-red-400 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Lap time overlay */}
        <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 rounded text-amber-400 font-orbitron text-xs font-bold backdrop-blur-sm">
          {Math.floor(lapTimeMs / 60000)}:{String(Math.floor((lapTimeMs % 60000) / 1000)).padStart(2, '0')}.{String(Math.floor(lapTimeMs % 1000)).padStart(3, '0')}
        </div>
      </div>

      {/* Expanded close on background click */}
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
