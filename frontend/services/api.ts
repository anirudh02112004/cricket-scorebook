import axios from "axios";
import { firebaseAuth } from "@/lib/firebase";

const defaultApiBaseUrl = "http://localhost:5000/api";
const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  (process.env.NODE_ENV === "development" ? defaultApiBaseUrl : "");

if (!apiBaseUrl) {
  throw new Error(
    "NEXT_PUBLIC_API_BASE_URL is not configured. Set it to the deployed Render backend URL.",
  );
}

const assetBaseUrl =
  process.env.NEXT_PUBLIC_ASSET_BASE_URL ?? "http://localhost:5000";

const api = axios.create({
  baseURL: apiBaseUrl,
  headers: { "Content-Type": "application/json" },
});

let authToken = "";

console.log("[api] baseURL:", apiBaseUrl);

api.interceptors.request.use(async (config) => {
  console.log("========== AXIOS ==========");
  console.log(config.method);
  console.log(config.url);
  console.log(config.headers);

  const protectedPath = Boolean(config.url && !String(config.url).startsWith("/search"));
  let token = authToken;

  if (firebaseAuth.currentUser) {
    token = await firebaseAuth.currentUser.getIdToken(true);
    authToken = token;
  }

  if (token) {
    config.headers = Object.assign({}, config.headers, {
      Authorization: `Bearer ${token}`,
    }) as typeof config.headers;
  }

  if (protectedPath) {
    const outgoingAuthorization = token ? `Bearer ${token}` : "<missing>";
    console.log(
      `[api] ${String(config.method || "GET").toUpperCase()} ${String(config.url || "")} Authorization header: ${outgoingAuthorization}`,
    );
  }

  return config;
});

export const setApiAuthToken = (token?: string | null) => {
  authToken = token || "";
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
