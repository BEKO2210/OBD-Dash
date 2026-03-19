import { useState, useEffect, useRef, useCallback } from 'react';

const DEFAULT_URL = 'ws://localhost:8765/ws/telemetry';
const RECONNECT_INTERVAL = 2000;

export default function useWebSocket(url = DEFAULT_URL) {
  const [data, setData] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const urlRef = useRef(url);
  const mountedRef = useRef(true);

  urlRef.current = url;

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    try {
      const ws = new WebSocket(urlRef.current);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        setConnected(true);
        setError(null);
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        try {
          const parsed = JSON.parse(event.data);
          setData(parsed);
        } catch (e) {
          console.warn('[APEX WS] Failed to parse message:', e);
        }
      };

      ws.onerror = (e) => {
        if (!mountedRef.current) return;
        setError('WebSocket connection error');
        console.warn('[APEX WS] Error:', e);
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setConnected(false);
        wsRef.current = null;
        reconnectTimerRef.current = setTimeout(() => {
          if (mountedRef.current) connect();
        }, RECONNECT_INTERVAL);
      };
    } catch (e) {
      setError(e.message);
      setConnected(false);
      reconnectTimerRef.current = setTimeout(() => {
        if (mountedRef.current) connect();
      }, RECONNECT_INTERVAL);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  return { data, connected, error };
}
