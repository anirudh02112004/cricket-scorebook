import axios from "axios";
import { firebaseAuth } from "@/lib/firebase";

const developmentApiBaseUrl = "http://localhost:5000/api";
const productionApiBaseUrl = "https://cricket-scorebook-njzy.onrender.com/api";
const normalizeApiBaseUrl = (value: string) => {
  const trimmed = value.replace(/\/$/, "");
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
};

const apiBaseUrl = normalizeApiBaseUrl(
  process.env.NEXT_PUBLIC_API_BASE_URL ??
    (process.env.NODE_ENV === "development" ? developmentApiBaseUrl : productionApiBaseUrl)
);

export const getApiBaseUrl = () => apiBaseUrl;

const assetBaseUrl =
  process.env.NEXT_PUBLIC_ASSET_BASE_URL ??
  (process.env.NODE_ENV === "development"
    ? "http://localhost:5000"
    : "https://cricket-scorebook-njzy.onrender.com");

const api = axios.create({
  baseURL: apiBaseUrl,
  headers: { "Content-Type": "application/json" },
});

let authToken = "";
let requestCounter = 0;

console.log("[api] baseURL:", apiBaseUrl);

api.interceptors.request.use(async (config) => {
  const requestId = ++requestCounter;
  const method = String(config.method || "GET").toUpperCase();
  const url = `${String(config.baseURL || "")}${String(config.url || "")}`;
  const cachedToken = authToken;
  const currentUserPresent = Boolean(firebaseAuth.currentUser);

  console.log(`[api][${requestId}] REQUEST START`);
  console.log(`[api][${requestId}] REQUEST URL`, url);
  console.log(`[api][${requestId}] METHOD`, method);
  console.log(`[api][${requestId}] TOKEN AVAILABLE`, Boolean(cachedToken));
  console.log(`[api][${requestId}] TOKEN LENGTH`, cachedToken ? cachedToken.length : 0);

  const protectedPath = Boolean(config.url && !String(config.url).startsWith("/search"));
  let token = cachedToken;

  if (currentUserPresent) {
    token = await firebaseAuth.currentUser.getIdToken(true);
    authToken = token;
  }

  const authHeaderAttached = Boolean(token);
  if (token) {
    config.headers = Object.assign({}, config.headers, {
      Authorization: `Bearer ${token}`,
    }) as typeof config.headers;
  }

  console.log(`[api][${requestId}] AUTH HEADER ATTACHED`, authHeaderAttached);

  if (protectedPath) {
    const outgoingAuthorization = token ? `Bearer ${token}` : "<missing>";
    console.log(
      `[api] ${String(config.method || "GET").toUpperCase()} ${String(config.url || "")} Authorization header: ${outgoingAuthorization}`,
    );
  }

  (config as typeof config & { metadata?: Record<string, unknown> }).metadata = {
    requestId,
    startedAt: Date.now(),
  };

  return config;
});

api.interceptors.response.use(
  (response) => {
    const metadata = response.config.metadata as
      | { requestId?: number; startedAt?: number }
      | undefined;
    const requestId = metadata?.requestId ?? 0;
    const elapsedMs = metadata?.startedAt ? Date.now() - metadata.startedAt : 0;
    console.log(`[api][${requestId}] REQUEST COMPLETED`, {
      status: response.status,
      url: response.config.url,
      method: String(response.config.method || "GET").toUpperCase(),
      elapsedMs,
    });
    return response;
  },
  (error) => {
    const config = error?.config as
      | ({ metadata?: { requestId?: number; startedAt?: number } } & Record<string, unknown>)
      | undefined;
    const requestId = config?.metadata?.requestId ?? 0;
    const elapsedMs = config?.metadata?.startedAt ? Date.now() - config.metadata.startedAt : 0;
    console.error(`[api][${requestId}] REQUEST FAILED`, {
      status: error?.response?.status ?? null,
      url: config?.url ?? null,
      method: String(config?.method || "GET").toUpperCase(),
      elapsedMs,
      message: error?.message ?? String(error),
    });
    return Promise.reject(error);
  },
);

export const setApiAuthToken = (token?: string | null) => {
  authToken = token || "";
  console.log("[api] auth token cached:", Boolean(authToken), "length:", authToken.length);
  if (authToken) {
    api.defaults.headers.common.Authorization = `Bearer ${authToken}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
};

export const messageOf = (error: unknown) =>
  axios.isAxiosError(error)
    ? error.response?.data?.message || error.response?.data?.error || error.message
    : "Something went wrong";

export const resolveAssetUrl = (value?: string | null) => {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/")) return `${assetBaseUrl}${value}`;
  return `${assetBaseUrl}/images/${value.replace(/^.*[\\/]/, "")}`;
};

export const cricketApi = {
  dashboard: () => api.get("/dashboard"),
  players: () => api.get("/players"),
  player: (id: string) => api.get(`/players/${id}`),
  career: (id: string) => api.get(`/players/${id}/career`),
  leaderboard: () => api.get("/players/leaderboard"),
  createPlayer: (data: unknown) => api.post("/players", data),
  updatePlayer: (id: string, data: unknown) => api.put(`/players/${id}`, data),
  deletePlayer: (id: string) => api.delete(`/players/${id}`),
  authMe: () => api.get("/auth/me"),
  matches: () => api.get("/matches"),
  match: (id: string) => api.get(`/matches/${id}`),
  createMatch: (data: unknown) => api.post("/matches", data),
  startMatch: (id: string, data?: unknown) => api.patch(`/matches/${id}/start`, data),
  changeBowler: (id: string, bowlerId: string) =>
    api.patch(`/matches/${id}/change-bowler`, { bowlerId }),
  selectNextBatsman: (id: string, batsmanId: string) =>
    api.patch(`/matches/${id}/select-next-batsman`, { batsmanId }),
  scoreboard: (id: string) => api.get(`/matches/${id}/scoreboard`),
  batting: (id: string) => api.get(`/matches/${id}/batting`),
  bowling: (id: string) => api.get(`/matches/${id}/bowling`),
  currentOver: (id: string) => api.get(`/matches/${id}/current-over`),
  commentary: (id: string) => api.get(`/matches/${id}/commentary`),
  partnership: (id: string) => api.get(`/matches/${id}/partnership`),
  summary: (id: string) => api.get(`/matches/${id}/summary`),
  history: () => api.get("/matches/history"),
  playerOfMatch: (id: string) =>
    api.get(`/matches/${id}/player-of-the-match`),
  scoreBall: (data: unknown) => api.post("/score", data),
  undo: (id: string) => api.patch(`/score/${id}/undo`),
  search: (query: string) => api.get("/search", { params: { query } }),
};

export default api;
