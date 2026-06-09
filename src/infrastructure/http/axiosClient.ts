import axios from 'axios';
import { API_BASE_URL } from '@/constants/api';
import { tauriHttpAdapter } from './tauriHttpAdapter';

/** True when running inside the Tauri webview (native HTTP available). */
function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
  // In the desktop app, route backend calls through Tauri's native HTTP so the
  // webview's CORS policy never applies (works in dev and packaged builds). In a
  // plain browser (`pnpm dev`) fall back to the default XHR/fetch adapter.
  ...(isTauriRuntime() ? { adapter: tauriHttpAdapter } : {}),
});
