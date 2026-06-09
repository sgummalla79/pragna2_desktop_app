import axios from 'axios';
import { API_BASE_URL } from '@/constants/api';

export const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  // withCredentials ensures the browser sends httpOnly session cookies
  // on every request once the backend switches to cookie-based auth.
  withCredentials: true,
  timeout: 15_000,
});
