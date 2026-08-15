"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/set-state-in-effect, @next/next/no-img-element */

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FormEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Activity,
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  CircleDot,
  Edit3,
  Flame,
  LayoutDashboard,
  Medal,
  Play,
  Plus,
  RefreshCw,
  Search as SearchIcon,
  Shield,
  Shuffle,
  Trash2,
  Trophy,
  Undo2,
  Users,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { cricketApi, getApiBaseUrl, messageOf, resolveAssetUrl } from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import { firebaseAuth } from "@/lib/firebase";
import GlassCard from "@/components/ui/GlassCard";
import LiveBadge from "@/components/ui/LiveBadge";
import PrimaryButton from "@/components/ui/PrimaryButton";
import SectionTitle from "@/components/ui/SectionTitle";
import StateCard from "@/components/ui/StateCard";
import { motion } from "framer-motion";

type PageKey =
  | "dashboard"
  | "players"
  | "profile"
  | "live"
  | "scoring"
  | "summary"
  | "history"
  | "leaders"
  | "search";

type MatchBundle = {
  match?: any;
  scoreboard?: any;
  batting?: any[];
  bowling?: any[];
  currentOver?: any;
  commentary?: any[];
  partnership?: any;
  summary?: any;
  playerOfMatch?: any;
};

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, page: "dashboard" },
  { href: "/live", label: "Live", icon: Activity, page: "live" },
  { href: "/scoring", label: "Scoring", icon: CircleDot, page: "scoring" },
  { href: "/players", label: "Players", icon: Users, page: "players" },
  { href: "/leaders", label: "Leaders", icon: Trophy, page: "leaders" },
  { href: "/history", label: "History", icon: CalendarDays, page: "history" },
  { href: "/search", label: "Search", icon: SearchIcon, page: "search" },
];

const dismissalOptions = [
  { label: "None", value: "None" },
  { label: "Bowled", value: "Bowled" },
  { label: "Caught", value: "Caught" },
  { label: "Run Out", value: "Run Out" },
  { label: "Obstructing the Field", value: "Obstructing the Field" },
  { label: "LBW", value: "LBW" },
  { label: "Hit Wicket", value: "Hit Wicket" },
  { label: "Stumped", value: "Stumped" },
  { label: "Retired", value: "Retired" },
];

const extraOptions = [
  { label: "None", value: "None" },
  { label: "Wide", value: "Wide" },
  { label: "No Ball", value: "NoBall" },
  { label: "Bye", value: "Bye" },
  { label: "Leg Bye", value: "LegBye" },
];

const MIN_PLAYERS_PER_TEAM = 5;
const MAX_PLAYERS_PER_TEAM = 11;

const formatDate = (value: string | Date | undefined) => {
  if (!value) return "Today";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Today"
    : new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(date);
};

const formatOvers = (overs?: number, balls?: number) => `${overs ?? 0}.${balls ?? 0}`;

const parseOvers = (overs?: string) => {
  if (!overs) return { completedOvers: 0, ballsInCurrentOver: 0 };
  const [completedOvers, ballsInCurrentOver] = overs.split(".");
  return {
    completedOvers: Number(completedOvers || 0),
    ballsInCurrentOver: Number(ballsInCurrentOver || 0),
  };
};

const ballLabel = (ball: any) => {
  if (!ball) return "•";
  if (ball.isWicket) return "W";
  const extra = normalizeExtraType(ball.extraType);
  if (extra === "Wide") return "Wd";
  if (extra === "NoBall") return "Nb";
  if (extra === "Bye") return `B${ball.extraRuns ?? 0}`;
  if (extra === "LegBye") return `Lb${ball.extraRuns ?? 0}`;
  const runs = Number(ball.runsOffBat ?? 0);
  return runs === 0 ? "•" : String(runs);
};

function normalizeExtraType(value: unknown) {
  const normalized = String(value || "None").replace(/\s+/g, "").toLowerCase();
  if (normalized === "wide") return "Wide";
  if (normalized === "noball") return "NoBall";
  if (normalized === "bye") return "Bye";
  if (normalized === "legbye") return "LegBye";
  return "None";
}

function Spinner() {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm text-slate-300">
        <span className="size-4 animate-spin rounded-full border-2 border-lime-300 border-r-transparent" />
        Loading cricket data
      </div>
    </div>
  );
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <GlassCard className="border-dashed border-white/15 bg-white/[0.03] p-8 text-center">
      <h3 className="text-lg font-black text-white">{title}</h3>
      {description ? (
        <p className="mx-auto mt-2 max-w-xl text-sm text-slate-400">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </GlassCard>
  );
}

function SectionCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <GlassCard className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.26em] text-lime-300/75">
            {title}
          </p>
          {subtitle ? (
            <p className="mt-2 text-sm text-slate-400">{subtitle}</p>
          ) : null}
        </div>
        {action ? <div>{action}</div> : null}
      </div>
      <div className="mt-5">{children}</div>
    </GlassCard>
  );
}

function TeamChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
        selected
          ? "bg-lime-300 text-slate-950"
          : "bg-white/5 text-slate-300 hover:bg-white/10"
      }`}
    >
      {label}
    </button>
  );
}

function PlayerPickerModal({
  open,
  title,
  subtitle,
  players,
  selectedId,
  onSelect,
  onConfirm,
  onClose,
  confirmLabel,
  secondaryLabel = "Cancel",
  onSecondary,
  busy = false,
  helperText,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  players: any[];
  selectedId: string;
  onSelect: (playerId: string) => void;
  onConfirm: () => void;
  onClose: () => void;
  confirmLabel: string;
  secondaryLabel?: string;
  onSecondary?: () => void;
  busy?: boolean;
  helperText?: string;
}) {
  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4 py-6 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-[2rem] border border-white/10 bg-[#0b1220]/95 p-5 shadow-[0_40px_120px_rgba(0,0,0,0.45)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-lime-300/75">
              Match flow
            </p>
            <h3 className="mt-2 text-2xl font-black text-white">{title}</h3>
            {subtitle ? <p className="mt-2 text-sm text-slate-400">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-10 place-items-center rounded-full bg-white/5 text-slate-300 transition hover:bg-white/10"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-5 max-h-[52vh] overflow-y-auto pr-1">
          <div className="grid gap-3 sm:grid-cols-2">
            {players.length ? (
              players.map((player) => {
                const selected = String(player._id) === String(selectedId);
                return (
                  <button
                    key={player._id}
                    type="button"
                    onClick={() => onSelect(player._id)}
                    className={`flex items-center gap-3 rounded-3xl border px-4 py-4 text-left transition ${
                      selected
                        ? "border-lime-300/40 bg-lime-300/10"
                        : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                    }`}
                  >
                    <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/5 text-sm font-black text-white">
                      {player.name?.slice(0, 1)?.toUpperCase() ?? "?"}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-black text-white">{player.name}</p>
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                        {player.role ?? "Player"}
                      </p>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="col-span-full rounded-3xl border border-dashed border-white/10 bg-white/[0.03] p-6 text-sm text-slate-400">
                No eligible players available.
              </div>
            )}
          </div>
        </div>

        {helperText ? <p className="mt-4 text-xs text-slate-500">{helperText}</p> : null}

        <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
          <PrimaryButton tone="ghost" onClick={onSecondary || onClose} disabled={busy}>
            {secondaryLabel}
          </PrimaryButton>
          <PrimaryButton onClick={onConfirm} disabled={!selectedId || busy || !players.length}>
            {busy ? "Working..." : confirmLabel}
          </PrimaryButton>
        </div>
      </div>
    </motion.div>
  );
}

function ConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onClose,
  busy = false,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  busy?: boolean;
}) {
  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4 py-6 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-[#0b1220]/95 p-5 shadow-[0_40px_120px_rgba(0,0,0,0.45)]"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-2xl font-black text-white">{title}</h3>
        {description ? <p className="mt-2 text-sm text-slate-400">{description}</p> : null}
        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <PrimaryButton tone="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </PrimaryButton>
          <PrimaryButton tone="danger" onClick={onConfirm} disabled={busy}>
            {busy ? "Working..." : confirmLabel}
          </PrimaryButton>
        </div>
      </div>
    </motion.div>
  );
}

function useMatchBundle(matchId?: string, refreshToken?: number) {
  const [data, setData] = useState<MatchBundle>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const lastMatchId = useRef<string | undefined>(undefined);

  const reload = useCallback(() => {
    setRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    let ignore = false;

    async function load() {
      if (!matchId) {
        setData({});
        setLoading(false);
        setError("");
        return;
      }

      if (lastMatchId.current !== matchId) {
        setData({});
        lastMatchId.current = matchId;
      }

      setLoading(true);
      setError("");

      try {
        const [matchRes, scoreboardRes, battingRes, bowlingRes, overRes, commentaryRes, partnershipRes, summaryRes, pomRes] =
          await Promise.all([
            cricketApi.match(matchId),
            cricketApi.scoreboard(matchId),
            cricketApi.batting(matchId),
            cricketApi.bowling(matchId),
            cricketApi.currentOver(matchId),
            cricketApi.commentary(matchId),
            cricketApi.partnership(matchId),
            cricketApi.summary(matchId),
            cricketApi.playerOfMatch(matchId),
          ]);

        if (ignore) return;

        setData({
          match: matchRes.data.match,
          scoreboard: scoreboardRes.data.scoreboard ?? scoreboardRes.data,
          batting: battingRes.data.batting ?? [],
          bowling: bowlingRes.data.bowling ?? [],
          currentOver: overRes.data,
          commentary: commentaryRes.data.commentary ?? [],
          partnership: partnershipRes.data.partnership ?? partnershipRes.data,
          summary: summaryRes.data.summary ?? summaryRes.data,
          playerOfMatch: pomRes.data.playerOfMatch,
        });
      } catch (err) {
        if (!ignore) setError(messageOf(err));
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    load();

    return () => {
      ignore = true;
    };
  }, [matchId, refreshToken, revision]);

  return { data, loading, error, reload };
}

export default function CricketApp({
  page,
  id,
  refreshToken = 0,
  onAction,
}: {
  page: PageKey;
  id?: string;
  refreshToken?: number;
  onAction?: (action: () => Promise<any>, success: string) => Promise<void>;
}) {
  const { loading: authLoading } = useAuth();
  const [data, setData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let ignore = false;

    async function load() {
      setLoading(true);
      setError("");
      console.log("[load] REQUEST START", {
        page,
        id: id ?? null,
        refreshToken,
        refreshKey,
        authLoading,
      });

      try {
        let nextData: Record<string, any> = {};

        if (page === "dashboard") {
          console.log("[load] REQUEST URL /dashboard + /players");
          const [dashboardResponse, playersResponse] = await Promise.all([
            cricketApi.dashboard(),
            cricketApi.players(),
          ]);
          const dashboardData = dashboardResponse.data.dashboard ?? {};
          const playersCount =
            playersResponse.data?.count ??
            playersResponse.data?.players?.length ??
            0;
          nextData = {
            ...dashboardData,
            stats: {
              ...(dashboardData.stats ?? {}),
              totalPlayers: playersCount,
            },
          };
        } else if (page === "players") {
          console.log("[load] REQUEST URL /players + /matches");
          const [playersRes, matchesRes] = await Promise.all([
            cricketApi.players(),
            cricketApi.matches(),
          ]);
          nextData = {
            players: playersRes.data.players ?? [],
            matches: matchesRes.data.matches ?? [],
          };
        } else if (page === "profile" && id) {
          const [playerRes, careerRes, matchesRes] = await Promise.all([
            cricketApi.player(id),
            cricketApi.career(id),
            cricketApi.matches(),
          ]);
          nextData = {
            player: playerRes.data.player,
            career: careerRes.data.career,
            matches: matchesRes.data.matches ?? [],
          };
        } else if (page === "history") {
          const [historyRes, matchesRes] = await Promise.all([
            cricketApi.history(),
            cricketApi.matches(),
          ]);
          nextData = {
            history: historyRes.data.history ?? [],
            matches: matchesRes.data.matches ?? [],
          };
        } else if (page === "leaders") {
          const response = await cricketApi.leaderboard();
          nextData = response.data.leaderboard ?? {};
        } else if (page === "live" || page === "scoring" || page === "summary") {
          const matchesRes = await cricketApi.matches();
          nextData = { matches: matchesRes.data.matches ?? [] };
        } else if (page === "search") {
          nextData = {};
        }

        if (!ignore) setData(nextData);
        console.log("[load] REQUEST COMPLETED", {
          page,
          id: id ?? null,
        });
      } catch (err) {
        console.error("[load] REQUEST FAILED", {
          page,
          id: id ?? null,
          message: messageOf(err),
        });
        if (!ignore) setError(messageOf(err));
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    load();

    return () => {
      ignore = true;
    };
  }, [page, id, refreshToken, refreshKey, authLoading]);

  const invoke = async (action: () => Promise<any>, success: string) => {
    try {
      if (onAction) {
        await onAction(action, success);
      } else {
        await action();
      }
      setNotice(success);
      setRefreshKey((value) => value + 1);
    } catch (err) {
      setError(messageOf(err));
    }
  };

  const activeMenu = useMemo(() => {
    if (page === "profile") return "/players";
    if (page === "summary") return "/history";
    return `/${page === "dashboard" ? "" : page}`;
  }, [page]);

  const content = () => {
    if (loading) return <Spinner />;
    if (error) {
      return (
        <EmptyState
          title="We hit a snag"
          description={error}
          action={
            <PrimaryButton tone="ghost" onClick={() => setRefreshKey((value) => value + 1)}>
              <RefreshCw size={15} />
              Try again
            </PrimaryButton>
          }
        />
      );
    }

    if (page === "dashboard") {
      return <DashboardView dashboard={data} />;
    }

    if (page === "players") {
      return (
        <PlayersView
          players={data.players ?? []}
          matches={data.matches ?? []}
          authLoading={authLoading}
          invoke={invoke}
        />
      );
    }

    if (page === "profile") {
      return (
        <ProfileViewEnhanced
          player={data.player}
          career={data.career}
          matches={data.matches ?? []}
        />
      );
    }

    if (page === "leaders") {
      return <LeadersView leaderboard={data} />;
    }

    if (page === "history") {
      return <HistoryView history={data.history ?? []} />;
    }

    if (page === "search") {
      return <SearchView />;
    }

    if (page === "summary") {
      const matches = data.matches ?? [];
      if (!matches.length) {
        return (
          <EmptyState
            title="No matches yet"
            description="Create a match from the Players screen after selecting both teams."
            action={<Link className="text-lime-300" href="/players">Go to Players</Link>}
          />
        );
      }
      return (
        <SummaryView
          matches={matches}
          selectedId={id}
          refreshToken={refreshToken}
        />
      );
    }

    const matches = data.matches ?? [];
    const activeMatches = matches.filter((match: any) => match.status !== "Completed");

    if (page === "scoring") {
      if (!activeMatches.length) {
        return (
          <EmptyState
            title="No active matches"
            description="Completed matches live in History and Summary."
            action={<Link className="text-lime-300" href="/history">Go to History</Link>}
          />
        );
      }
      return (
        <ScoringView
          matches={activeMatches}
          selectedId={id}
          refreshToken={refreshToken}
        />
      );
    }

    if (!activeMatches.length) {
      return (
        <EmptyState
          title="No active matches"
          description="Start a new match to bring up the live console."
          action={<Link className="text-lime-300" href="/players">Go to Players</Link>}
        />
      );
    }

    return <LiveView matches={activeMatches} selectedId={id} refreshToken={refreshToken} />;
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#070912] text-white">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_15%_10%,rgba(190,242,100,0.16),transparent_25%),radial-gradient(circle_at_85%_0%,rgba(56,189,248,0.14),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent)]" />
      <div className="relative mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-lime-300 text-slate-950 shadow-[0_18px_40px_rgba(190,242,100,0.2)]">
              <Trophy size={20} />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-slate-500">
                Cricket Scorebook
              </p>
              <h1 className="text-lg font-black tracking-tight">
                Cric<span className="text-lime-300">Pulse</span>
              </h1>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <LiveBadge live />
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-400">
              Connected to backend
            </span>
          </div>
        </header>

        <nav className="mb-6 flex gap-2 overflow-x-auto pb-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              activeMenu === item.href || (page === "dashboard" && item.page === "dashboard");

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2 text-sm font-bold transition ${
                  active
                    ? "bg-lime-300 text-slate-950"
                    : "bg-white/5 text-slate-300 hover:bg-white/10"
                }`}
              >
                <Icon size={15} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {notice ? (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 rounded-2xl border border-lime-300/20 bg-lime-300/10 px-4 py-3 text-sm text-lime-100"
          >
            {notice}
          </motion.div>
        ) : null}

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          {content()}
        </motion.div>
      </div>
    </main>
  );
}

function DashboardView({ dashboard }: { dashboard: Record<string, any> }) {
  const stats = dashboard?.stats ?? {};
  const recentMatches = dashboard?.recentMatches ?? [];

  return (
    <div className="space-y-6">
      <SectionTitle
        eyebrow="Dashboard"
        title={
          <>
            Your cricket, <span className="text-lime-300">at a glance</span>
          </>
        }
        subtitle="Live match, team counts, recent results, and season leaders all in one place."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StateCard label="Players" value={stats.totalPlayers ?? 0} icon={<Users size={18} />} />
        <StateCard label="Matches" value={stats.totalMatches ?? 0} icon={<CalendarDays size={18} />} />
        <StateCard
          label="Completed"
          value={stats.completedMatches ?? 0}
          icon={<Shield size={18} />}
        />
        <StateCard
          label="Live"
          value={stats.liveMatches ?? 0}
          icon={<Flame size={18} />}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
        <GlassCard className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-rose-300">
                Live Match
              </p>
              <h2 className="mt-2 text-2xl font-black text-white">
                {dashboard?.liveMatch ? (
                  `${dashboard.liveMatch.teamA} vs ${dashboard.liveMatch.teamB}`
                ) : (
                  "No match in progress"
                )}
              </h2>
            </div>
            <LiveBadge live={Boolean(dashboard?.liveMatch)} />
          </div>

          {dashboard?.liveMatch ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                  Score
                </p>
                <p className="mt-2 text-4xl font-black text-lime-300">
                  {dashboard.liveMatch.score}
                </p>
              </div>
              <div className="rounded-3xl bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                  Overs
                </p>
                <p className="mt-2 text-4xl font-black text-white">
                  {dashboard.liveMatch.overs}
                </p>
              </div>
              <div className="rounded-3xl bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                  Quick action
                </p>
                <Link
                  href="/live"
                  className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-lime-300"
                >
                  Open live view <ChevronRight size={15} />
                </Link>
              </div>
            </div>
          ) : (
            <p className="mt-5 text-sm text-slate-400">
              Start a match to see live scoring here.
            </p>
          )}
        </GlassCard>

        <GlassCard className="p-6">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-lime-300/75">
            Top performers
          </p>
          <div className="mt-4 space-y-4 text-sm">
            <div className="rounded-3xl bg-white/5 p-4">
              <p className="text-slate-500">Highest scorer</p>
              <p className="mt-1 font-black text-white">
                {dashboard?.topRunScorer?.name ?? "Not available"}
              </p>
            </div>
            <div className="rounded-3xl bg-white/5 p-4">
              <p className="text-slate-500">Best bowler</p>
              <p className="mt-1 font-black text-white">
                {dashboard?.topWicketTaker?.name ?? "Not available"}
              </p>
            </div>
          </div>
        </GlassCard>
      </div>

      <SectionCard title="Recent matches" subtitle="Latest completed games from the backend.">
        <div className="space-y-3">
          {recentMatches.length ? (
            recentMatches.map((match: any) => (
              <div
                key={match._id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/10 bg-white/[0.03] px-4 py-4"
              >
                <div>
                  <p className="font-black text-white">
                    {match.teamA?.teamName ?? "Team A"}{" "}
                    <span className="text-slate-500">vs</span>{" "}
                    {match.teamB?.teamName ?? "Team B"}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-500">
                    {formatDate(match.matchDate)} · {match.status}
                  </p>
                </div>
                <Link
                  href={`/summary/${match._id}`}
                  className="inline-flex items-center gap-2 text-sm font-bold text-lime-300"
                >
                  Open summary <ChevronRight size={15} />
                </Link>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-400">No completed matches yet.</p>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

function PlayersView({
  players,
  matches,
  authLoading,
  invoke,
}: {
  players: any[];
  matches: any[];
  authLoading: boolean;
  invoke: (action: () => Promise<any>, success: string) => Promise<void>;
}) {
  const { player: authPlayer } = useAuth();
  const router = useRouter();
  const [showPlayerForm, setShowPlayerForm] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<any | null>(null);
  const [playerDraft, setPlayerDraft] = useState({
    name: "",
    role: "Batsman",
    battingStyle: "",
    bowlingStyle: "",
    jerseyNumber: "",
    profileImage: "",
  });
  const [selectedTeamA, setSelectedTeamA] = useState<string[]>([]);
  const [selectedTeamB, setSelectedTeamB] = useState<string[]>([]);
  const [teamAName, setTeamAName] = useState("Team A");
  const [teamBName, setTeamBName] = useState("Team B");
  const [matchDate, setMatchDate] = useState("");
  const [totalOvers, setTotalOvers] = useState(8);
  const [tossWinner, setTossWinner] = useState<"A" | "B">("A");
  const [electedTo, setElectedTo] = useState<"Batting" | "Bowling">("Batting");
  const [matchFormError, setMatchFormError] = useState("");
  const [savingMatch, setSavingMatch] = useState(false);
  const [deletePlayer, setDeletePlayer] = useState<any | null>(null);

  useEffect(() => {
    if (!editingPlayer) return;
    setPlayerDraft({
      name: editingPlayer.name ?? "",
      role: editingPlayer.role ?? "Batsman",
      battingStyle: editingPlayer.battingStyle ?? "",
      bowlingStyle: editingPlayer.bowlingStyle ?? "",
      jerseyNumber: editingPlayer.jerseyNumber?.toString?.() ?? "",
      profileImage: editingPlayer.profileImage ?? "",
    });
  }, [editingPlayer]);

  const resetDraft = () => {
    setPlayerDraft({
      name: "",
      role: "Batsman",
      battingStyle: "",
      bowlingStyle: "",
      jerseyNumber: "",
      profileImage: "",
    });
  };

  const toggleTeamMember = (team: "A" | "B", playerId: string) => {
    if (team === "A") {
      setSelectedTeamA((current) =>
        current.includes(playerId)
          ? current.filter((id) => id !== playerId)
          : [...current.filter((id) => id !== playerId), playerId],
      );
      setSelectedTeamB((current) => current.filter((id) => id !== playerId));
    } else {
      setSelectedTeamB((current) =>
        current.includes(playerId)
          ? current.filter((id) => id !== playerId)
          : [...current.filter((id) => id !== playerId), playerId],
      );
      setSelectedTeamA((current) => current.filter((id) => id !== playerId));
    }
  };

  const submitPlayer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = {
      ...playerDraft,
      jerseyNumber: playerDraft.jerseyNumber
        ? Number(playerDraft.jerseyNumber)
        : undefined,
    };

    await invoke(
      () =>
        editingPlayer
          ? cricketApi.updatePlayer(editingPlayer._id, payload)
          : cricketApi.createPlayer(payload),
      editingPlayer ? "Player updated" : "Player created",
    );

    setShowPlayerForm(false);
    setEditingPlayer(null);
    resetDraft();
  };

  const submitMatch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMatchFormError("");

    console.log("[match:create] FORM SUBMIT FIRED");
    console.log("[match:create] selectedTeamA:", selectedTeamA);
    console.log("[match:create] selectedTeamB:", selectedTeamB);
    console.log("[match:create] authLoading:", authLoading);

    if (savingMatch) {
      console.log("[match:create] validation:", "blocked because a save is already in progress");
      return;
    }

    if (authLoading) {
      const errorMessage = "Authentication is still loading. Please wait and try again.";
      console.log("[match:create] validation:", errorMessage);
      setMatchFormError(errorMessage);
      toast.error(errorMessage);
      return;
    }

    const teamAPlayers = players
      .filter((player) => selectedTeamA.includes(player._id))
      .map((player) => player._id);
    const teamBPlayers = players
      .filter((player) => selectedTeamB.includes(player._id))
      .map((player) => player._id);

    const validationDetails = {
      teamAPlayers: teamAPlayers.length,
      teamBPlayers: teamBPlayers.length,
      minPlayersPerTeam: MIN_PLAYERS_PER_TEAM,
      maxPlayersPerTeam: MAX_PLAYERS_PER_TEAM,
    };
    console.log("[match:create] validation:", validationDetails);

    if (
      teamAPlayers.length < MIN_PLAYERS_PER_TEAM ||
      teamBPlayers.length < MIN_PLAYERS_PER_TEAM
    ) {
      const errorMessage = `Each team needs at least ${MIN_PLAYERS_PER_TEAM} players.`;
      setMatchFormError(errorMessage);
      toast.error(errorMessage);
      return;
    }

    if (
      teamAPlayers.length > MAX_PLAYERS_PER_TEAM ||
      teamBPlayers.length > MAX_PLAYERS_PER_TEAM
    ) {
      const errorMessage = `Each team can have at most ${MAX_PLAYERS_PER_TEAM} players.`;
      setMatchFormError(errorMessage);
      toast.error(errorMessage);
      return;
    }

    const payload = {
      matchDate: matchDate || undefined,
      tossWinner,
      electedTo,
      totalOvers,
      teamA: { teamName: teamAName, players: teamAPlayers },
      teamB: { teamName: teamBName, players: teamBPlayers },
    };

    const requestUrl = `${getApiBaseUrl().replace(/\/$/, "")}/matches`;
    console.log("[match:create] payload:", payload);

    setSavingMatch(true);

    try {
      const currentUser = firebaseAuth.currentUser;
      let firebaseToken: string | null = null;
      if (currentUser) {
        firebaseToken = await currentUser.getIdToken(true);
      }
      console.log("[match:create] Firebase bearer token exists:", Boolean(firebaseToken));
      console.log("[match:create] Firebase bearer token length:", firebaseToken?.length ?? 0);

      console.log("[match:create] POST START", { url: requestUrl });
      const response = await cricketApi.createMatch(payload);

      console.log("[match:create] POST RESPONSE", {
        status: response.status,
        hasMatch: Boolean(response.data?.match),
        matchId: response.data?.match?._id ?? response.data?.matchId ?? null,
      });

      const createdMatchId = response.data?.match?._id ?? response.data?.matchId;
      if (!createdMatchId) {
        throw new Error("Backend did not return a match ID");
      }

      toast.success("Match saved successfully");

      setSelectedTeamA([]);
      setSelectedTeamB([]);
      setMatchDate("");
      setTotalOvers(8);
      setTeamAName("Team A");
      setTeamBName("Team B");
      setTossWinner("A");
      setElectedTo("Batting");
      setMatchFormError("");

      router.push(`/scoring?id=${createdMatchId}`);
    } catch (error) {
      console.error("[match:create] POST ERROR", error);
      const reason = messageOf(error);
      console.error("[match:create] failure reason:", reason);
      const errorMessage = `Failed to save match: ${reason}`;
      setMatchFormError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSavingMatch(false);
    }
  };

  const activeMatches = matches.filter((match) => match.status !== "Completed");

  return (
    <div className="space-y-6">
      <SectionTitle
        eyebrow="Players"
        title="Manage squads and create matches"
        subtitle="Add, edit, delete, and profile players. Build Team A and Team B before saving a match."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StateCard label="Active players" value={players.length} icon={<Users size={18} />} />
        <StateCard label="Open matches" value={activeMatches.length} icon={<CalendarDays size={18} />} />
        <StateCard
          label="Team A picks"
          value={selectedTeamA.length}
          icon={<Shield size={18} />}
          hint="Need 5 to 11 players"
        />
        <StateCard
          label="Team B picks"
          value={selectedTeamB.length}
          icon={<Shield size={18} />}
          hint="Need 5 to 11 players"
        />
      </div>

      {authPlayer ? (
        <SectionCard
          title="Your linked profile"
          subtitle="Google sign-in already owns one Player profile. Manage those fields from the Profile page."
          action={
            <Link
              href={`/players/${authPlayer._id}`}
              className="inline-flex items-center gap-2 text-sm font-bold text-lime-300"
            >
              Open profile
              <ChevronRight size={15} />
            </Link>
          }
        >
          <p className="text-sm text-slate-400">
            Manual player creation is disabled for signed-in accounts to keep the one-user, one-player model intact.
          </p>
        </SectionCard>
      ) : (
        <SectionCard
          title="Create Player"
          subtitle="Backend currently supports the standard player fields only."
          action={
            <PrimaryButton
              tone="ghost"
              onClick={() => {
                setEditingPlayer(null);
                resetDraft();
                setShowPlayerForm((value) => !value);
              }}
            >
              <Plus size={16} />
              {showPlayerForm ? "Close" : "Add player"}
            </PrimaryButton>
          }
        >
          {showPlayerForm ? (
            <form onSubmit={submitPlayer} className="grid gap-4 md:grid-cols-2">
              <input
                required
                value={playerDraft.name}
                onChange={(event) =>
                  setPlayerDraft((current) => ({ ...current, name: event.target.value }))
                }
                className="input md:col-span-2"
                placeholder="Player name"
              />
              <select
                value={playerDraft.role}
                onChange={(event) =>
                  setPlayerDraft((current) => ({ ...current, role: event.target.value }))
                }
                className="input"
              >
                <option>Batsman</option>
                <option>Bowler</option>
                <option>All-Rounder</option>
                <option>Wicket-Keeper</option>
              </select>
              <input
                value={playerDraft.jerseyNumber}
                onChange={(event) =>
                  setPlayerDraft((current) => ({
                    ...current,
                    jerseyNumber: event.target.value,
                  }))
                }
                className="input"
                type="number"
                placeholder="Jersey number"
              />
              <input
                value={playerDraft.battingStyle}
                onChange={(event) =>
                  setPlayerDraft((current) => ({
                    ...current,
                    battingStyle: event.target.value,
                  }))
                }
                className="input"
                placeholder="Batting style"
              />
              <input
                value={playerDraft.bowlingStyle}
                onChange={(event) =>
                  setPlayerDraft((current) => ({
                    ...current,
                    bowlingStyle: event.target.value,
                  }))
                }
                className="input"
                placeholder="Bowling style"
              />
              <input
                value={playerDraft.profileImage}
                onChange={(event) =>
                  setPlayerDraft((current) => ({
                    ...current,
                    profileImage: event.target.value,
                  }))
                }
                className="input"
                placeholder="Image file or URL"
              />
              <div className="md:col-span-2 flex justify-end">
                <PrimaryButton type="submit">
                  {editingPlayer ? "Update player" : "Save player"}
                </PrimaryButton>
              </div>
            </form>
          ) : (
            <p className="text-sm text-slate-400">
              Create a player first, then use the selection grid below to build teams.
            </p>
          )}
        </SectionCard>
      )}

      <SectionCard
        title="Create Teams + Match"
        subtitle="The current backend stores toss, decision, overs, date, and the two team lineups. Venue, match name, and ball type are not persisted by the API."
        action={
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Shuffle size={14} />
            {MIN_PLAYERS_PER_TEAM} to {MAX_PLAYERS_PER_TEAM} players per team
          </div>
        }
      >
        <form onSubmit={submitMatch} className="grid gap-4 xl:grid-cols-2">
          {matchFormError ? (
            <div className="xl:col-span-2 rounded-2xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
              {matchFormError}
            </div>
          ) : null}
          <input
            required
            value={teamAName}
            onChange={(event) => setTeamAName(event.target.value)}
            className="input"
            placeholder="Team A name"
          />
          <input
            required
            value={teamBName}
            onChange={(event) => setTeamBName(event.target.value)}
            className="input"
            placeholder="Team B name"
          />
          <input
            value={matchDate}
            onChange={(event) => setMatchDate(event.target.value)}
            className="input"
            type="date"
          />
          <input
            value={totalOvers}
            onChange={(event) => setTotalOvers(Number(event.target.value))}
            className="input"
            type="number"
            min={1}
            max={20}
          />
          <select
            value={tossWinner}
            onChange={(event) => setTossWinner(event.target.value as "A" | "B")}
            className="input"
          >
            <option value="A">Team A won toss</option>
            <option value="B">Team B won toss</option>
          </select>
          <select
            value={electedTo}
            onChange={(event) => setElectedTo(event.target.value as "Batting" | "Bowling")}
            className="input"
          >
            <option value="Batting">Bat first</option>
            <option value="Bowling">Field first</option>
          </select>

          <div className="xl:col-span-2 grid gap-4 lg:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between">
                <p className="font-black text-white">{teamAName}</p>
                <p className="text-xs text-slate-500">{selectedTeamA.length} selected</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {players.map((player) => (
                  <button
                    key={`team-a-${player._id}`}
                    type="button"
                    onClick={() => toggleTeamMember("A", player._id)}
                    className={`rounded-2xl px-3 py-2 text-sm transition ${
                      selectedTeamA.includes(player._id)
                        ? "bg-lime-300 text-slate-950"
                        : "bg-white/5 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    {player.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between">
                <p className="font-black text-white">{teamBName}</p>
                <p className="text-xs text-slate-500">{selectedTeamB.length} selected</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {players.map((player) => (
                  <button
                    key={`team-b-${player._id}`}
                    type="button"
                    onClick={() => toggleTeamMember("B", player._id)}
                    className={`rounded-2xl px-3 py-2 text-sm transition ${
                      selectedTeamB.includes(player._id)
                        ? "bg-sky-300 text-slate-950"
                        : "bg-white/5 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    {player.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="xl:col-span-2 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-sm text-slate-400">
              <p>
                Team A: <span className="text-white">{selectedTeamA.length}</span>
              </p>
              <p>
                Team B: <span className="text-white">{selectedTeamB.length}</span>
              </p>
            </div>
            <PrimaryButton
              type="submit"
              disabled={
                savingMatch ||
                authLoading ||
                !players.length
              }
            >
              {savingMatch
                ? "Saving Match..."
                : authLoading
                  ? "Loading auth..."
                  : "Save Match"}
            </PrimaryButton>
          </div>
        </form>
      </SectionCard>

      <div className="grid gap-5 xl:grid-cols-2">
        <SectionCard title="Players" subtitle="Tap edit, profile, or delete from each card.">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {players.length ? (
              players.map((player) => (
                <GlassCard key={player._id} className="p-4">
                  <div className="flex items-start gap-3">
                    {player.profileImage ? (
                      <img
                        alt={player.name}
                        src={resolveAssetUrl(player.profileImage)}
                        className="size-14 rounded-2xl object-cover ring-2 ring-lime-300/25"
                      />
                    ) : (
                      <div className="grid size-14 place-items-center rounded-2xl bg-lime-300/10 text-lg font-black text-lime-300">
                        {player.name?.slice(0, 1)?.toUpperCase() ?? "?"}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-lg font-black text-white">
                        {player.name}
                      </p>
                      <p className="text-sm text-lime-300">{player.role}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {player.battingStyle || "Batting style not set"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-2xl bg-white/5 p-3">
                      <p className="text-xs text-slate-500">Runs</p>
                      <p className="mt-1 text-xl font-black text-white">
                        {player.career?.batting?.runs ?? 0}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white/5 p-3">
                      <p className="text-xs text-slate-500">Wickets</p>
                      <p className="mt-1 text-xl font-black text-white">
                        {player.career?.bowling?.wickets ?? 0}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={`/players/${player._id}`}
                      className="inline-flex items-center gap-1 text-sm font-bold text-lime-300"
                    >
                      View <ChevronRight size={14} />
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPlayer(player);
                        setShowPlayerForm(true);
                      }}
                      className="inline-flex items-center gap-1 text-sm font-bold text-white"
                    >
                      <Edit3 size={14} /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletePlayer(player)}
                      className="inline-flex items-center gap-1 text-sm font-bold text-rose-200"
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                </GlassCard>
              ))
            ) : (
              <EmptyState
                title="No players yet"
                description="Add the first player to start building squads."
              />
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Matches"
          subtitle="Saved matches can be started, scored, or opened in summary."
        >
          <div className="space-y-3">
            {matches.length ? (
              matches.map((match) => (
                <div
                  key={match._id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/10 bg-white/[0.03] px-4 py-4"
                >
                  <div>
                    <p className="font-black text-white">
                      {match.teamA?.teamName ?? "Team A"}{" "}
                      <span className="text-slate-500">vs</span>{" "}
                      {match.teamB?.teamName ?? "Team B"}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.24em] text-slate-500">
                      {match.status} · {formatDate(match.matchDate)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {match.status === "Scheduled" ? (
                      <Link
                        href={`/scoring?id=${match._id}`}
                        className="inline-flex items-center gap-1 rounded-2xl bg-lime-300 px-4 py-2 text-sm font-bold text-slate-950"
                      >
                        <Play size={15} />
                        Start innings
                      </Link>
                    ) : null}
                    <Link
                      href="/scoring"
                      className="inline-flex items-center gap-1 rounded-2xl bg-white/5 px-4 py-2 text-sm font-bold text-white hover:bg-white/10"
                    >
                      Score <ChevronRight size={14} />
                    </Link>
                    <Link
                      href={`/summary/${match._id}`}
                      className="inline-flex items-center gap-1 rounded-2xl bg-lime-300 px-4 py-2 text-sm font-bold text-slate-950"
                    >
                      Summary <ChevronRight size={14} />
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                title="No matches created"
                description="Build two teams above to save your first match."
              />
            )}
          </div>
        </SectionCard>
      </div>

      <ConfirmModal
        open={Boolean(deletePlayer)}
        title={`Delete ${deletePlayer?.name ?? "player"}?`}
        description="This removes the player from the roster. Existing match history remains intact."
        confirmLabel="Delete player"
        onConfirm={async () => {
          if (!deletePlayer) return;
          await invoke(() => cricketApi.deletePlayer(deletePlayer._id), "Player deleted");
          setDeletePlayer(null);
        }}
        onClose={() => setDeletePlayer(null)}
      />
    </div>
  );
}

function ProfileView({
  player,
  career,
  matches,
}: {
  player: any;
  career: any;
  matches: any[];
}) {
  if (!player && !career) {
    return (
      <EmptyState
        title="Player not found"
        description="The backend could not locate this player."
        action={
          <Link className="text-lime-300" href="/players">
            Back to players
          </Link>
        }
      />
    );
  }

  const profile = career || player;
  const batting = profile?.batting ?? {};
  const bowling = profile?.bowling ?? {};

  const recentMatches = (() => {
    const name = profile?.name;
    if (!name) return [];
    return matches
      .filter((match) => JSON.stringify(match).toLowerCase().includes(name.toLowerCase()))
      .slice(0, 5);
  })();

  return (
    <div className="space-y-6">
      <Link
        href="/players"
        className="inline-flex items-center gap-2 text-sm font-bold text-lime-300"
      >
        <ArrowLeft size={15} />
        Back to players
      </Link>

      <GlassCard className="overflow-hidden p-0">
        <div className="bg-[linear-gradient(135deg,rgba(190,242,100,0.16),rgba(56,189,248,0.12),transparent)] p-6">
          <div className="flex flex-wrap items-center gap-4">
            {player?.profileImage ? (
              <img
                alt={profile.name}
                src={resolveAssetUrl(player.profileImage)}
                className="size-20 rounded-3xl object-cover ring-4 ring-white/10"
              />
            ) : (
              <div className="grid size-20 place-items-center rounded-3xl bg-white/10 text-2xl font-black text-lime-300">
                {profile?.name?.slice(0, 1)?.toUpperCase() ?? "?"}
              </div>
            )}
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-lime-300/75">
                {profile.role ?? "Player"}
              </p>
              <h1 className="mt-2 text-4xl font-black tracking-tight">
                {profile.name}
              </h1>
              <p className="mt-2 text-sm text-slate-300">
                {player?.battingStyle || "Batting style not listed"} ·{" "}
                {player?.bowlingStyle || "Bowling style not listed"}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-6 sm:grid-cols-2 xl:grid-cols-6">
          <StateCard label="Matches" value={batting.matches ?? 0} />
          <StateCard label="Runs" value={batting.runs ?? 0} />
          <StateCard label="Average" value={Number(batting.average ?? 0).toFixed(2)} />
          <StateCard label="Strike rate" value={Number(batting.strikeRate ?? 0).toFixed(2)} />
          <StateCard label="Wickets" value={bowling.wickets ?? 0} />
          <StateCard label="Economy" value={Number(bowling.economy ?? 0).toFixed(2)} />
        </div>
      </GlassCard>

      <SectionCard title="Career breakdown" subtitle="Batting, bowling, and fielding statistics.">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
              Batting
            </p>
            <div className="mt-4 space-y-2 text-sm text-slate-300">
              <p>Matches: {batting.matches ?? 0}</p>
              <p>Innings: {batting.innings ?? 0}</p>
              <p>Runs: {batting.runs ?? 0}</p>
              <p>Highest: {batting.highestScore ?? 0}</p>
            </div>
          </div>
          <div className="rounded-3xl bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
              Bowling
            </p>
            <div className="mt-4 space-y-2 text-sm text-slate-300">
              <p>Matches: {bowling.matches ?? 0}</p>
              <p>Innings: {bowling.innings ?? 0}</p>
              <p>Wickets: {bowling.wickets ?? 0}</p>
              <p>Best: {bowling.bestFigures ? `${bowling.bestFigures.wickets}/${bowling.bestFigures.runs}` : "0/0"}</p>
            </div>
          </div>
          <div className="rounded-3xl bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
              Fielding
            </p>
            <div className="mt-4 space-y-2 text-sm text-slate-300">
              <p>Catches: {profile?.fielding?.catches ?? 0}</p>
              <p>Run outs: {profile?.fielding?.runOuts ?? 0}</p>
              <p>Stumpings: {profile?.fielding?.stumpings ?? 0}</p>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Recent matches"
        subtitle="Recent match history for this player is not exposed directly by the current backend, so we infer it from stored matches when possible."
      >
        {recentMatches.length ? (
          <div className="space-y-3">
            {recentMatches.map((match) => (
              <div
                key={match._id}
                className="rounded-3xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-slate-300"
              >
                {match.teamA?.teamName ?? "Team A"} vs {match.teamB?.teamName ?? "Team B"}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">
            The backend does not currently provide player-specific recent matches.
          </p>
        )}
      </SectionCard>
    </div>
  );
}

function ProfileViewEnhanced({
  player,
  career,
  matches,
}: {
  player: any;
  career: any;
  matches: any[];
}) {
  const { user, player: authPlayer, refreshSession } = useAuth();
  const [localPlayer, setLocalPlayer] = useState<any | null>(player ?? null);
  const [profileDraft, setProfileDraft] = useState({
    role: player?.role ?? "All-Rounder",
    battingStyle: player?.battingStyle ?? "",
    bowlingStyle: player?.bowlingStyle ?? "",
    jerseyNumber: player?.jerseyNumber?.toString?.() ?? "",
    profileImage: player?.profileImage ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");

  useEffect(() => {
    setLocalPlayer(player ?? null);
    setProfileDraft({
      role: player?.role ?? "All-Rounder",
      battingStyle: player?.battingStyle ?? "",
      bowlingStyle: player?.bowlingStyle ?? "",
      jerseyNumber: player?.jerseyNumber?.toString?.() ?? "",
      profileImage: player?.profileImage ?? "",
    });
  }, [player]);

  if (!player && !career) {
    return (
      <EmptyState
        title="Player not found"
        description="The backend could not locate this player."
        action={
          <Link className="text-lime-300" href="/players">
            Back to players
          </Link>
        }
      />
    );
  }

  const currentPlayer = localPlayer ?? player;
  const profile = career || currentPlayer;
  const batting = profile?.batting ?? {};
  const bowling = profile?.bowling ?? {};
  const canEdit =
    Boolean(authPlayer?._id) && String(authPlayer._id) === String(currentPlayer?._id);

  const recentMatches = (() => {
    const name = profile?.name;
    if (!name) return [];
    return matches
      .filter((match) => JSON.stringify(match).toLowerCase().includes(name.toLowerCase()))
      .slice(0, 5);
  })();

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEdit || !currentPlayer?._id) return;

    setSaving(true);
    setSaveError("");
    setSaveSuccess("");

    try {
      const response = await cricketApi.updatePlayer(currentPlayer._id, {
        role: profileDraft.role,
        battingStyle: profileDraft.battingStyle,
        bowlingStyle: profileDraft.bowlingStyle,
        jerseyNumber: profileDraft.jerseyNumber ? Number(profileDraft.jerseyNumber) : undefined,
        profileImage: profileDraft.profileImage,
      });
      setLocalPlayer(response.data.player);
      setSaveSuccess("Profile updated successfully");
      await refreshSession();
    } catch (error) {
      setSaveError(messageOf(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Link
        href="/players"
        className="inline-flex items-center gap-2 text-sm font-bold text-lime-300"
      >
        <ArrowLeft size={15} />
        Back to players
      </Link>

      <GlassCard className="overflow-hidden p-0">
        <div className="bg-[linear-gradient(135deg,rgba(190,242,100,0.16),rgba(56,189,248,0.12),transparent)] p-6">
          <div className="flex flex-wrap items-center gap-4">
            {currentPlayer?.profileImage || user?.photoURL ? (
              <img
                alt={profile.name}
                src={resolveAssetUrl(currentPlayer?.profileImage || user?.photoURL)}
                className="size-20 rounded-3xl object-cover ring-4 ring-white/10"
              />
            ) : (
              <div className="grid size-20 place-items-center rounded-3xl bg-white/10 text-2xl font-black text-lime-300">
                {profile?.name?.slice(0, 1)?.toUpperCase() ?? "?"}
              </div>
            )}
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-lime-300/75">
                {profile.role ?? "Player"}
              </p>
              <h1 className="mt-2 text-4xl font-black tracking-tight">
                {profile.name}
              </h1>
              <p className="mt-2 text-sm text-slate-300">
                {currentPlayer?.battingStyle || "Batting style not listed"} ·{" "}
                {currentPlayer?.bowlingStyle || "Bowling style not listed"}
              </p>
              <p className="mt-2 text-xs uppercase tracking-[0.24em] text-slate-500">
                {user?.email || currentPlayer?.email || "Email not available"}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-6 sm:grid-cols-2 xl:grid-cols-6">
          <StateCard label="Matches" value={batting.matches ?? 0} />
          <StateCard label="Runs" value={batting.runs ?? 0} />
          <StateCard label="Average" value={Number(batting.average ?? 0).toFixed(2)} />
          <StateCard label="Strike rate" value={Number(batting.strikeRate ?? 0).toFixed(2)} />
          <StateCard label="Wickets" value={bowling.wickets ?? 0} />
          <StateCard label="Economy" value={Number(bowling.economy ?? 0).toFixed(2)} />
        </div>
      </GlassCard>

      {canEdit ? (
        <SectionCard
          title="Edit profile"
          subtitle="You can only update the permitted profile fields."
        >
          <form onSubmit={saveProfile} className="grid gap-4 md:grid-cols-2">
            {saveError ? (
              <div className="md:col-span-2 rounded-2xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
                {saveError}
              </div>
            ) : null}
            {saveSuccess ? (
              <div className="md:col-span-2 rounded-2xl border border-lime-300/20 bg-lime-300/10 px-4 py-3 text-sm text-lime-100">
                {saveSuccess}
              </div>
            ) : null}
            <input
              value={profileDraft.role}
              onChange={(event) =>
                setProfileDraft((current) => ({ ...current, role: event.target.value }))
              }
              className="input"
              placeholder="Role"
            />
            <input
              value={profileDraft.jerseyNumber}
              onChange={(event) =>
                setProfileDraft((current) => ({ ...current, jerseyNumber: event.target.value }))
              }
              className="input"
              type="number"
              placeholder="Jersey number"
            />
            <input
              value={profileDraft.battingStyle}
              onChange={(event) =>
                setProfileDraft((current) => ({ ...current, battingStyle: event.target.value }))
              }
              className="input"
              placeholder="Batting style"
            />
            <input
              value={profileDraft.bowlingStyle}
              onChange={(event) =>
                setProfileDraft((current) => ({ ...current, bowlingStyle: event.target.value }))
              }
              className="input"
              placeholder="Bowling style"
            />
            <input
              value={profileDraft.profileImage}
              onChange={(event) =>
                setProfileDraft((current) => ({ ...current, profileImage: event.target.value }))
              }
              className="input md:col-span-2"
              placeholder="Profile image URL"
            />
            <div className="md:col-span-2 flex justify-end">
              <PrimaryButton type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save profile"}
              </PrimaryButton>
            </div>
          </form>
        </SectionCard>
      ) : null}

      <SectionCard title="Career breakdown" subtitle="Batting, bowling, and fielding statistics.">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
              Batting
            </p>
            <div className="mt-4 space-y-2 text-sm text-slate-300">
              <p>Matches: {batting.matches ?? 0}</p>
              <p>Innings: {batting.innings ?? 0}</p>
              <p>Runs: {batting.runs ?? 0}</p>
              <p>Highest: {batting.highestScore ?? 0}</p>
            </div>
          </div>
          <div className="rounded-3xl bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
              Bowling
            </p>
            <div className="mt-4 space-y-2 text-sm text-slate-300">
              <p>Matches: {bowling.matches ?? 0}</p>
              <p>Innings: {bowling.innings ?? 0}</p>
              <p>Wickets: {bowling.wickets ?? 0}</p>
              <p>Best: {bowling.bestFigures ? `${bowling.bestFigures.wickets}/${bowling.bestFigures.runs}` : "0/0"}</p>
            </div>
          </div>
          <div className="rounded-3xl bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
              Fielding
            </p>
            <div className="mt-4 space-y-2 text-sm text-slate-300">
              <p>Catches: {profile?.fielding?.catches ?? 0}</p>
              <p>Run outs: {profile?.fielding?.runOuts ?? 0}</p>
              <p>Stumpings: {profile?.fielding?.stumpings ?? 0}</p>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Recent matches"
        subtitle="Recent match history for this player is not exposed directly by the current backend, so we infer it from stored matches when possible."
      >
        {recentMatches.length ? (
          <div className="space-y-3">
            {recentMatches.map((match) => (
              <div
                key={match._id}
                className="rounded-3xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-slate-300"
              >
                {match.teamA?.teamName ?? "Team A"} vs {match.teamB?.teamName ?? "Team B"}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">
            The backend does not currently provide player-specific recent matches.
          </p>
        )}
      </SectionCard>
    </div>
  );
}

function LeadersView({ leaderboard }: { leaderboard: Record<string, any> }) {
  const groups = [
    { title: "Most runs", items: leaderboard?.mostRuns ?? [], value: "runs" },
    { title: "Most wickets", items: leaderboard?.mostWickets ?? [], value: "wickets" },
    { title: "Highest strike rate", items: leaderboard?.highestStrikeRate ?? [], value: "strikeRate" },
    { title: "Best economy", items: leaderboard?.bestEconomy ?? [], value: "economy" },
    { title: "Most fours", items: leaderboard?.mostFours ?? [], value: "fours" },
    { title: "Most sixes", items: leaderboard?.mostSixes ?? [], value: "sixes" },
  ];

  return (
    <div className="space-y-6">
      <SectionTitle
        eyebrow="Leaderboard"
        title={
          <>
            Season <span className="text-lime-300">leaders</span>
          </>
        }
        subtitle="Top five players in each category."
      />

      <div className="grid gap-5 md:grid-cols-2">
        {groups.map((group) => (
          <SectionCard key={group.title} title={group.title}>
            <div className="space-y-2">
              {group.items.length ? (
                group.items.map((player: any, index: number) => (
                  <div
                    key={`${group.title}-${player.name}-${index}`}
                    className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="grid size-7 place-items-center rounded-full bg-lime-300/15 text-xs font-black text-lime-300">
                        {index + 1}
                      </span>
                      <span className="font-bold text-white">{player.name}</span>
                    </div>
                    <span className="font-black text-lime-300">
                      {player[group.value] ?? 0}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400">No player statistics yet.</p>
              )}
            </div>
          </SectionCard>
        ))}
      </div>
    </div>
  );
}

function HistoryView({ history }: { history: any[] }) {
  return (
    <div className="space-y-6">
      <SectionTitle
        eyebrow="History"
        title="Completed matches"
        subtitle="Open any match for its full summary."
      />
      <div className="space-y-3">
        {history.length ? (
          history.map((match) => (
            <GlassCard key={match._id} className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div>
                <p className="font-black text-white">
                  {match.teamA} <span className="text-slate-500">vs</span> {match.teamB}
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  {match.scoreA} · {match.scoreB}
                </p>
                <p className="mt-2 text-xs uppercase tracking-[0.24em] text-slate-500">
                  {formatDate(match.date)} · {match.status}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-lime-300">
                  {match.winningMargin || "Completed"}
                </p>
                {match.playerOfMatch?.name ? (
                  <p className="mt-2 inline-flex rounded-full border border-lime-300/20 bg-lime-300/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-lime-200">
                    POM {match.playerOfMatch.name}
                  </p>
                ) : null}
                <Link
                  href={`/summary/${match._id}`}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-slate-400"
                >
                  View summary <ChevronRight size={14} />
                </Link>
              </div>
            </GlassCard>
          ))
        ) : (
          <EmptyState
            title="No completed matches yet"
            description="Once a match finishes, it will appear here."
          />
        )}
      </div>
    </div>
  );
}

function SearchView() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<{ players: any[]; matches: any[] }>({
    players: [],
    matches: [],
  });

  const runSearch = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!query.trim()) {
      setResults({ players: [], matches: [] });
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await cricketApi.search(query.trim());
      setResults({
        players: response.data.players ?? [],
        matches: response.data.matches ?? [],
      });
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionTitle
        eyebrow="Search"
        title="Search players and matches"
        subtitle="Find a player profile or open a match by team name."
      />

      <form onSubmit={runSearch} className="flex flex-wrap gap-3">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="input min-w-72 flex-1"
          placeholder="Search player or team name..."
        />
        <PrimaryButton type="submit">
          <SearchIcon size={15} />
          Search
        </PrimaryButton>
      </form>

      {loading ? <Spinner /> : null}
      {error ? <EmptyState title="Search failed" description={error} /> : null}

      <div className="grid gap-5 xl:grid-cols-2">
        <SectionCard title="Players" subtitle="Matching player profiles.">
          <div className="space-y-3">
            {results.players.length ? (
              results.players.map((player) => (
                <Link
                  key={player._id}
                  href={`/players/${player._id}`}
                  className="flex items-center justify-between rounded-3xl border border-white/10 bg-white/[0.03] px-4 py-4 transition hover:bg-white/[0.05]"
                >
                  <div>
                    <p className="font-black text-white">{player.name}</p>
                    <p className="mt-1 text-sm text-slate-400">{player.role}</p>
                  </div>
                  <ChevronRight size={16} className="text-lime-300" />
                </Link>
              ))
            ) : (
              <p className="text-sm text-slate-400">No players matched this search.</p>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Matches" subtitle="Matching team names.">
          <div className="space-y-3">
            {results.matches.length ? (
              results.matches.map((match) => (
                <Link
                  key={match._id}
                  href={`/summary/${match._id}`}
                  className="flex items-center justify-between rounded-3xl border border-white/10 bg-white/[0.03] px-4 py-4 transition hover:bg-white/[0.05]"
                >
                  <div>
                    <p className="font-black text-white">
                      {match.teamA?.teamName ?? "Team A"}{" "}
                      <span className="text-slate-500">vs</span>{" "}
                      {match.teamB?.teamName ?? "Team B"}
                    </p>
                    <p className="mt-1 text-sm text-slate-400">{match.status}</p>
                  </div>
                  <ChevronRight size={16} className="text-lime-300" />
                </Link>
              ))
            ) : (
              <p className="text-sm text-slate-400">No matches matched this search.</p>
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function LiveView({
  matches,
  selectedId,
  refreshToken,
}: {
  matches: any[];
  selectedId?: string;
  refreshToken: number;
}) {
  const active = useMemo(
    () =>
      matches.find((match) => match.status === "In Progress") ??
      matches.find((match) => match.status === "Scheduled") ??
      matches[0],
    [matches],
  );
  return (
    <ScoringView
      matches={matches}
      selectedId={selectedId || active?._id}
      refreshToken={refreshToken}
    />
  );
}

function SummaryView({
  matches,
  selectedId,
  refreshToken,
}: {
  matches: any[];
  selectedId?: string;
  refreshToken: number;
}) {
  const latestCompleted = useMemo(
    () => [...matches].reverse().find((match) => match.status === "Completed"),
    [matches],
  );
  const [matchId, setMatchId] = useState(selectedId || latestCompleted?._id || "");

  useEffect(() => {
    if (selectedId) setMatchId(selectedId);
    else if (latestCompleted?._id) setMatchId(latestCompleted._id);
  }, [selectedId, latestCompleted?._id]);

  const bundle = useMatchBundle(matchId, refreshToken);

  return (
    <div className="space-y-6">
      <SectionTitle
        eyebrow="Summary"
        title="Match summary"
        subtitle="Final score, winner, margin, top performers, and scorecards."
      />

      <MatchPicker matches={matches} value={matchId} onChange={setMatchId} />
      <MatchCenter bundle={bundle} mode="summary" />
    </div>
  );
}

function ScoringView({
  matches,
  selectedId,
  refreshToken,
}: {
  matches: any[];
  selectedId?: string;
  refreshToken: number;
}) {
  const initialMatch = useMemo(
    () =>
      (selectedId && matches.find((match) => match._id === selectedId)) ??
      matches.find((match) => match.status === "In Progress") ??
      matches.find((match) => match.status === "Scheduled") ??
      matches[0],
    [matches, selectedId],
  );
  const [matchId, setMatchId] = useState(initialMatch?._id || "");
  const bundle = useMatchBundle(matchId, refreshToken);
  const match = bundle.data.match;

  useEffect(() => {
    if (selectedId) setMatchId(selectedId);
    else if (initialMatch?._id) setMatchId(initialMatch._id);
  }, [selectedId, initialMatch?._id]);

  const computedBattingSide =
    match?.matchState?.battingTeam ??
    (((match?.tossWinner === "A" && match?.electedTo === "Batting") ||
      (match?.tossWinner === "B" && match?.electedTo === "Bowling"))
      ? "A"
      : match?.tossWinner
        ? "B"
        : undefined);
  const battingTeam =
    computedBattingSide === "A"
      ? match?.teamA
      : computedBattingSide === "B"
        ? match?.teamB
        : undefined;
  const bowlingTeam =
    computedBattingSide === "A"
      ? match?.teamB
      : computedBattingSide === "B"
        ? match?.teamA
        : undefined;
  const battingPlayers = battingTeam?.players ?? [];
  const bowlingPlayers = bowlingTeam?.players ?? [];

  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupStage, setSetupStage] = useState<"striker" | "nonStriker" | "bowler">(
    "striker",
  );
  const [openingStrikerId, setOpeningStrikerId] = useState("");
  const [openingNonStrikerId, setOpeningNonStrikerId] = useState("");
  const [openingBowlerId, setOpeningBowlerId] = useState("");
  const [bowlerPickerOpen, setBowlerPickerOpen] = useState(false);
  const [bowlerSelectionId, setBowlerSelectionId] = useState("");
  const [nextBatsmanId, setNextBatsmanId] = useState("");
  const [runsOffBat, setRunsOffBat] = useState(0);
  const [extraType, setExtraType] = useState("None");
  const [extraRuns, setExtraRuns] = useState(0);
  const [isWicket, setIsWicket] = useState(false);
  const [dismissalType, setDismissalType] = useState("None");
  const [fielderId, setFielderId] = useState("");
  const [isBouncer, setIsBouncer] = useState(false);
  const isSecondInningsSetup =
    match?.status === "Scheduled" && match?.matchState?.innings === 2 && match?.target != null;

  useEffect(() => {
    setFeedback("");
    setSetupOpen(false);
    setSetupStage("striker");
    setOpeningStrikerId("");
    setOpeningNonStrikerId("");
    setOpeningBowlerId("");
    setBowlerPickerOpen(false);
    setBowlerSelectionId("");
    setNextBatsmanId("");
    setRunsOffBat(0);
    setExtraType("None");
    setExtraRuns(0);
    setIsWicket(false);
    setDismissalType("None");
    setFielderId("");
    setIsBouncer(false);
  }, [matchId]);

  useEffect(() => {
    if (match?.status === "In Progress" && match.matchState?.awaitingNextBatsman) {
      setNextBatsmanId("");
    }
  }, [match?.status, match?.matchState?.awaitingNextBatsman]);

  useEffect(() => {
    if (isSecondInningsSetup && !setupOpen) {
      openSetup();
    }
  }, [isSecondInningsSetup, setupOpen]);

  const currentBowlerId = match?.matchState?.currentBowler?._id;

  useEffect(() => {
    if (match?.status === "In Progress" && !match.matchState?.awaitingNextBatsman && !currentBowlerId) {
      setBowlerPickerOpen(true);
    }
  }, [match?.status, match?.matchState?.awaitingNextBatsman, currentBowlerId]);

  const dismissedNames = useMemo(
    () =>
      new Set(
        (bundle.data.batting ?? [])
          .filter((player: any) => {
            const status = String(player.status ?? "").toLowerCase();
            return status === "out" || status === "retired";
          })
          .map((player: any) => String(player.name ?? "").toLowerCase()),
      ),
    [bundle.data.batting],
  );

  const currentStrikerId = String(match?.matchState?.striker?._id ?? "");
  const currentNonStrikerId = String(match?.matchState?.nonStriker?._id ?? "");
  const currentBowlerName = match?.matchState?.currentBowler?.name ?? "Not set";

  const openingStrikerOptions = battingPlayers;
  const openingNonStrikerOptions = battingPlayers.filter(
    (player: any) => String(player._id) !== String(openingStrikerId),
  );
  const openingBowlerOptions = bowlingPlayers;
  const nextBatsmanOptions = battingPlayers.filter((player: any) => {
    const nameKey = String(player.name ?? "").toLowerCase();
    return (
      String(player._id) !== currentStrikerId &&
      String(player._id) !== currentNonStrikerId &&
      !dismissedNames.has(nameKey)
    );
  });

  const awaitingNextBatsman = Boolean(
    match?.status === "In Progress" && match.matchState?.awaitingNextBatsman,
  );
  const requiresBowlerSelection = Boolean(
    match?.status === "In Progress" &&
      !match.matchState?.awaitingNextBatsman &&
      !match.matchState?.currentBowler,
  );
  const scoringDisabled =
    busy ||
    setupOpen ||
    awaitingNextBatsman ||
    requiresBowlerSelection ||
    bowlerPickerOpen ||
    match?.status !== "In Progress";
  const wicketFielders =
    dismissalType === "Caught" ||
    dismissalType === "Run Out" ||
    dismissalType === "Stumped" ||
    dismissalType === "Obstructing the Field";
  const isOpeningFlow = match?.status === "Scheduled";
  const setupHeading = isSecondInningsSetup ? "Start Second Innings" : "Start Match";

  const runAction = useCallback(
    async (action: () => Promise<any>, success: string) => {
      if (!matchId) return false;
      setBusy(true);
      setFeedback("");
      try {
        await action();
        setFeedback(success);
        await bundle.reload();
        return true;
      } catch (error) {
        setFeedback(messageOf(error));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [bundle, matchId],
  );

  function openSetup() {
    setFeedback("");
    setSetupOpen(true);
    setSetupStage("striker");
    setOpeningStrikerId("");
    setOpeningNonStrikerId("");
    setOpeningBowlerId("");
  }

  const startMatch = async () => {
    if (!matchId || !openingStrikerId || !openingNonStrikerId || !openingBowlerId) return;
    const ok = await runAction(
      () =>
        cricketApi.startMatch(matchId, {
          strikerId: openingStrikerId,
          nonStrikerId: openingNonStrikerId,
          bowlerId: openingBowlerId,
        }),
      "Match started",
    );
    if (ok) setSetupOpen(false);
  };

  const selectNextBatsman = async () => {
    if (!matchId || !nextBatsmanId) return;
    const ok = await runAction(
      () => cricketApi.selectNextBatsman(matchId, nextBatsmanId),
      "Next batsman selected",
    );
    if (ok) setNextBatsmanId("");
  };

  const changeBowler = async () => {
    if (!matchId || !bowlerSelectionId) return;
    const ok = await runAction(
      () => cricketApi.changeBowler(matchId, bowlerSelectionId),
      "Bowler changed",
    );
    if (ok) setBowlerPickerOpen(false);
  };

  const scoreDelivery = async () => {
    if (!matchId) return;
    const resolvedExtraType = extraType;
    const resolvedExtraRuns =
      resolvedExtraType === "Wide" || resolvedExtraType === "NoBall"
        ? Math.max(1, Number(extraRuns || 1))
        : Number(extraRuns || 0);

    const ok = await runAction(
      () =>
        cricketApi.scoreBall({
          matchId,
          runsOffBat: Number(runsOffBat || 0),
          extraType: resolvedExtraType,
          extraRuns: resolvedExtraRuns,
          isWicket,
          dismissalType: isWicket ? dismissalType : undefined,
          fielder: fielderId || undefined,
          isBouncer,
        }),
      "Delivery recorded",
    );
    if (ok) {
      setRunsOffBat(0);
      setExtraType("None");
      setExtraRuns(0);
      setIsWicket(false);
      setDismissalType("None");
      setFielderId("");
      setIsBouncer(false);
    }
  };

  const undo = async () => {
    if (!matchId) return;
    await runAction(() => cricketApi.undo(matchId), "Last ball undone");
  };

  const scorecardOpeningNote =
    isSecondInningsSetup
      ? "Select the second-innings openers and opening bowler before scoring resumes."
      : "Choose striker, non-striker, and opening bowler before the first ball.";

  return (
    <div className="space-y-6">
      <SectionTitle
        eyebrow="Live Match"
        title="Professional scoring console"
        subtitle="Select openers before the first ball. Wickets and over changes pause scoring until the next choice is made."
        action={
          <PrimaryButton tone="ghost" onClick={undo} disabled={busy}>
            <Undo2 size={15} />
            Undo
          </PrimaryButton>
        }
      />

      <MatchPicker matches={matches} value={matchId} onChange={setMatchId} />

      {!match ? (
        <EmptyState
          title="Select a match"
          description="Choose a scheduled or in-progress match to start scoring."
        />
      ) : (
        <>
          {feedback ? (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm ${
                feedback.toLowerCase().includes("select") ||
                feedback.toLowerCase().includes("failed") ||
                feedback.toLowerCase().includes("must")
                  ? "border-rose-300/20 bg-rose-300/10 text-rose-100"
                  : "border-lime-300/20 bg-lime-300/10 text-lime-100"
              }`}
            >
              {feedback}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StateCard
              label="Score"
              value={`${battingTeam?.score ?? 0}/${battingTeam?.wickets ?? 0}`}
            />
            <StateCard
              label="Overs"
              value={formatOvers(battingTeam?.completedOvers, battingTeam?.ballsInCurrentOver)}
            />
            <StateCard label="Status" value={match.status} icon={<Flame size={18} />} />
            <StateCard label="Target" value={match.target ?? "NA"} />
          </div>

          {isOpeningFlow ? (
            <SectionCard
              title={setupHeading}
              subtitle={scorecardOpeningNote}
              action={
                <PrimaryButton onClick={openSetup}>
                  <Play size={15} />
                  {isSecondInningsSetup ? "Start second innings" : "Choose openers"}
                </PrimaryButton>
              }
            >
              <p className="text-sm text-slate-400">
                {match.teamA?.teamName ?? "Team A"} vs {match.teamB?.teamName ?? "Team B"}
              </p>
            </SectionCard>
          ) : null}

          <MatchCenter bundle={bundle} mode="live" />

          <SectionCard
            title="Ball scoring"
            subtitle="Score the delivery. The next batsman and next bowler are selected with modal prompts."
            action={
              <div className="flex flex-wrap items-center gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-500">
                    Current bowler
                  </p>
                  <p className="mt-1 text-sm font-black text-white">{currentBowlerName}</p>
                </div>
                <PrimaryButton
                  type="button"
                  tone="ghost"
                  onClick={() => {
                    setBowlerSelectionId("");
                    setBowlerPickerOpen(true);
                  }}
                  disabled={!bowlingPlayers.length || busy}
                >
                  <Shuffle size={15} />
                  {requiresBowlerSelection ? "Select bowler" : "Change bowler"}
                </PrimaryButton>
              </div>
            }
          >
            <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">
                  Runs
                </p>
                <div className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-7">
                  {[0, 1, 2, 3, 4, 5, 6].map((runs) => (
                    <button
                      key={runs}
                      type="button"
                      onClick={() => setRunsOffBat(runs)}
                      disabled={scoringDisabled}
                      className={`rounded-2xl py-4 text-lg font-black transition ${
                        runsOffBat === runs
                          ? "bg-lime-300 text-slate-950"
                          : "bg-white/5 text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-slate-500"
                      }`}
                    >
                      {runs}
                    </button>
                  ))}
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">
                      Extra
                    </p>
                    <select
                      value={extraType}
                      onChange={(event) => setExtraType(event.target.value)}
                      className="input mt-3 w-full"
                      disabled={scoringDisabled}
                    >
                      {extraOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">
                      Extra runs
                    </p>
                    <input
                      value={extraRuns}
                      onChange={(event) => setExtraRuns(Number(event.target.value))}
                      type="number"
                      min={0}
                      className="input mt-3 w-full"
                      disabled={scoringDisabled}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center gap-3">
                  <input
                    checked={isWicket}
                    onChange={(event) => setIsWicket(event.target.checked)}
                    type="checkbox"
                    disabled={scoringDisabled}
                  />
                  <label className="font-bold text-white">Wicket</label>
                </div>

                <div className="mt-4">
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">
                    Dismissal type
                  </p>
                  <select
                    value={dismissalType}
                    onChange={(event) => setDismissalType(event.target.value)}
                    className="input mt-3 w-full"
                    disabled={!isWicket || scoringDisabled}
                  >
                    {dismissalOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-4">
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-500">
                    Fielder
                  </p>
                  <select
                    value={fielderId}
                    onChange={(event) => setFielderId(event.target.value)}
                    className="input mt-3 w-full"
                    disabled={!wicketFielders || scoringDisabled}
                  >
                    <option value="">Select fielder</option>
                    {battingPlayers.concat(bowlingPlayers).map((player: any) => (
                      <option key={player._id} value={player._id}>
                        {player.name}
                      </option>
                    ))}
                  </select>
                </div>

                <label className="mt-4 flex items-center gap-2 text-sm text-slate-300">
                  <input
                    checked={isBouncer}
                    onChange={(event) => setIsBouncer(event.target.checked)}
                    type="checkbox"
                    disabled={scoringDisabled}
                  />
                  Bouncer
                </label>

                <PrimaryButton className="mt-6 w-full" onClick={scoreDelivery} disabled={scoringDisabled}>
                  Record ball
                </PrimaryButton>
              </div>
            </div>
          </SectionCard>
        </>
      )}

      <PlayerPickerModal
        open={setupOpen}
        title={
          setupStage === "striker"
            ? "Select striker"
            : setupStage === "nonStriker"
              ? "Select non-striker"
              : "Select opening bowler"
        }
        subtitle={
          setupStage === "striker"
            ? "Choose the first batsman from the batting team."
            : setupStage === "nonStriker"
              ? "Choose the partner from the batting team."
              : "Choose the opening bowler from the bowling team."
        }
        players={
          setupStage === "striker"
            ? openingStrikerOptions
            : setupStage === "nonStriker"
              ? openingNonStrikerOptions.filter(
                  (player: any) => String(player._id) !== String(openingStrikerId),
                )
              : openingBowlerOptions
        }
        selectedId={
          setupStage === "striker"
            ? openingStrikerId
            : setupStage === "nonStriker"
              ? openingNonStrikerId
              : openingBowlerId
        }
        onSelect={(playerId) => {
          if (setupStage === "striker") setOpeningStrikerId(playerId);
          else if (setupStage === "nonStriker") setOpeningNonStrikerId(playerId);
          else setOpeningBowlerId(playerId);
        }}
        onConfirm={async () => {
          if (setupStage === "striker") {
            setSetupStage("nonStriker");
            return;
          }

          if (setupStage === "nonStriker") {
            setSetupStage("bowler");
            return;
          }

          await startMatch();
        }}
        onClose={() => setSetupOpen(false)}
        confirmLabel={setupStage === "bowler" ? "Start match" : "Next"}
        secondaryLabel={setupStage === "striker" ? "Cancel" : "Back"}
        onSecondary={() => {
          if (setupStage === "nonStriker") setSetupStage("striker");
          else if (setupStage === "bowler") setSetupStage("nonStriker");
          else setSetupOpen(false);
        }}
        busy={busy}
        helperText="The batting and bowling teams are enforced by the toss result. Only eligible players are shown."
      />

      <PlayerPickerModal
        open={awaitingNextBatsman}
        title="Select next batsman"
        subtitle="Scoring is paused until the next batsman is chosen."
        players={nextBatsmanOptions}
        selectedId={nextBatsmanId}
        onSelect={setNextBatsmanId}
        onConfirm={selectNextBatsman}
        onClose={() => undefined}
        confirmLabel="Continue innings"
        secondaryLabel="Waiting"
        busy={busy}
        helperText="Current striker, current non-striker, and dismissed players are excluded."
      />

      <PlayerPickerModal
        open={requiresBowlerSelection || bowlerPickerOpen}
        title="Select bowler"
        subtitle="The next over cannot start until a bowling-team player is chosen."
        players={bowlingPlayers}
        selectedId={bowlerSelectionId}
        onSelect={setBowlerSelectionId}
        onConfirm={changeBowler}
        onClose={() => setBowlerPickerOpen(false)}
        confirmLabel="Start over"
        secondaryLabel="Close"
        busy={busy}
        helperText="Only bowling-team players are shown."
      />
    </div>
  );
}

function MatchPicker({
  matches,
  value,
  onChange,
}: {
  matches: any[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Shuffle size={15} />
        Select match
      </div>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="input min-w-72 flex-1"
      >
        {matches.map((match) => (
          <option key={match._id} value={match._id}>
            {match.teamA?.teamName ?? "Team A"} vs {match.teamB?.teamName ?? "Team B"} ·{" "}
            {match.status}
          </option>
        ))}
      </select>
    </div>
  );
}

function MatchCenter({
  bundle,
  mode,
}: {
  bundle: {
    data: MatchBundle;
    loading: boolean;
    error: string;
  };
  mode: "live" | "summary";
}) {
  const { data, loading, error } = bundle;

  if (error) {
    return <EmptyState title="Could not load match" description={error} />;
  }

  if (loading && !data.match) {
    return <Spinner />;
  }

  if (!data.match) {
    return (
      <EmptyState
        title="No match selected"
        description="Pick a match to load the live scoreboard."
      />
    );
  }

  const match = data.match;
  const scoreboard = data.scoreboard ?? {};
  const computedBattingSide =
    match.matchState?.battingTeam ??
    (((match.tossWinner === "A" && match.electedTo === "Batting") ||
      (match.tossWinner === "B" && match.electedTo === "Bowling"))
      ? "A"
      : match.tossWinner
        ? "B"
        : undefined);
  const battingTeam =
    computedBattingSide === "A"
      ? match.teamA
      : computedBattingSide === "B"
        ? match.teamB
        : match.teamA;
  const bowlingTeam =
    computedBattingSide === "A"
      ? match.teamB
      : computedBattingSide === "B"
        ? match.teamA
        : match.teamB;
  const parsedOvers = parseOvers(scoreboard.overs);
  const ballsRemaining =
    typeof match.rules?.maxOvers === "number"
      ? match.rules.maxOvers * 6 - (battingTeam.completedOvers * 6 + battingTeam.ballsInCurrentOver)
      : null;
  const needRuns =
    match.target != null ? Math.max((match.target ?? 0) - (battingTeam.score ?? 0), 0) : null;
  const currentRR =
    parsedOvers.completedOvers + parsedOvers.ballsInCurrentOver / 6 > 0
      ? (battingTeam.score ?? 0) /
        (parsedOvers.completedOvers + parsedOvers.ballsInCurrentOver / 6)
      : 0;
  const requiredRR =
    ballsRemaining && ballsRemaining > 0 && needRuns != null
      ? needRuns / (ballsRemaining / 6)
      : 0;

  const currentOver = data.currentOver?.balls ?? [];
  const summary = data.summary ?? {};
  const recentBatting = data.batting ?? [];
  const recentBowling = data.bowling ?? [];
  const playerOfMatch = data.playerOfMatch ?? match.playerOfMatch;
  const extrasTotal = Number(
    (battingTeam.extras?.wides ?? 0) +
      (battingTeam.extras?.noBalls ?? 0) +
      (battingTeam.extras?.byes ?? 0) +
      (battingTeam.extras?.legByes ?? 0),
  );

  return (
    <div className="relative grid gap-5 xl:grid-cols-[1.4fr_0.6fr]">
      {loading ? (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-[2rem] bg-slate-950/40 backdrop-blur-[1px]">
          <div className="rounded-full border border-white/10 bg-slate-950/90 px-4 py-2 text-xs font-bold uppercase tracking-[0.24em] text-slate-300">
            Refreshing match
          </div>
        </div>
      ) : null}

      <GlassCard className="overflow-hidden p-0">
        <div className="bg-[linear-gradient(135deg,rgba(190,242,100,0.16),rgba(56,189,248,0.12),transparent)] p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <LiveBadge live={match.status === "In Progress"} />
              <h2 className="mt-4 text-3xl font-black tracking-tight">
                {match.teamA?.teamName ?? "Team A"}{" "}
                <span className="text-slate-500">vs</span>{" "}
                {match.teamB?.teamName ?? "Team B"}
              </h2>
              <p className="mt-2 text-sm text-slate-300">
                {match.status} · {formatDate(match.matchDate)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-5xl font-black text-lime-300">
                {battingTeam.score ?? 0}
                <span className="text-slate-500">/</span>
                {battingTeam.wickets ?? 0}
              </p>
              <p className="mt-2 text-sm text-slate-300">
                {formatOvers(battingTeam.completedOvers, battingTeam.ballsInCurrentOver)} overs
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Runs / Wkts</p>
              <p className="mt-2 text-2xl font-black text-white">
                {battingTeam.score ?? 0}/{battingTeam.wickets ?? 0}
              </p>
            </div>
            <div className="rounded-3xl bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Overs</p>
              <p className="mt-2 text-2xl font-black text-white">
                {formatOvers(battingTeam.completedOvers, battingTeam.ballsInCurrentOver)}
              </p>
            </div>
            <div className="rounded-3xl bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Extras</p>
              <p className="mt-2 text-2xl font-black text-white">{extrasTotal}</p>
            </div>
            <div className="rounded-3xl bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Need / RRR</p>
              <p className="mt-2 text-2xl font-black text-white">
                {needRuns ?? "NA"} / {requiredRR.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-3xl bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Current RR</p>
              <p className="mt-2 text-2xl font-black text-white">{currentRR.toFixed(2)}</p>
            </div>
            <div className="rounded-3xl bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Balls left</p>
              <p className="mt-2 text-2xl font-black text-white">{ballsRemaining ?? "NA"}</p>
            </div>
            <div className="rounded-3xl bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Target</p>
              <p className="mt-2 text-2xl font-black text-white">{match.target ?? "NA"}</p>
            </div>
            <div className="rounded-3xl bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Status</p>
              <p className="mt-2 text-2xl font-black text-white">{match.status}</p>
            </div>
          </div>

          {mode === "summary" || match.status === "Completed" ? (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className="rounded-3xl bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Winner</p>
                <p className="mt-2 text-2xl font-black text-lime-300">
                  {(match.winner ?? summary.winner)
                    ? (match.winner ?? summary.winner) === "Tie"
                      ? "Tie"
                      : `Team ${match.winner ?? summary.winner}`
                    : "Pending"}
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  {match.winningMargin ?? summary.winningMargin ?? "Waiting for completion"}
                </p>
              </div>
              <div className="rounded-3xl bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Player of match</p>
                <p className="mt-2 text-2xl font-black text-white">
                  {playerOfMatch?.name ?? match.playerOfMatch?.name ?? "Pending"}
                </p>
                {(playerOfMatch?.role ?? match.playerOfMatch?.role) ? (
                  <p className="mt-1 text-sm text-slate-400">
                    {playerOfMatch?.role ?? match.playerOfMatch?.role}
                  </p>
                ) : null}
                {playerOfMatch?.score != null ? (
                  <p className="mt-3 text-sm text-lime-300">
                    Runs {playerOfMatch.batting?.runs ?? 0} · Wkts {playerOfMatch.bowling?.wickets ?? 0}
                    · Catches {playerOfMatch.fielding?.catches ?? 0}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Striker</p>
              <p className="mt-2 text-xl font-black text-white">
                {scoreboard.striker?.name ?? match.matchState?.striker?.name ?? "—"}
              </p>
            </div>
            <div className="rounded-3xl bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Non-striker</p>
              <p className="mt-2 text-xl font-black text-white">
                {scoreboard.nonStriker?.name ?? match.matchState?.nonStriker?.name ?? "—"}
              </p>
            </div>
            <div className="rounded-3xl bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Bowler</p>
              <p className="mt-2 text-xl font-black text-white">
                {scoreboard.bowler?.name ?? match.matchState?.currentBowler?.name ?? "—"}
              </p>
            </div>
          </div>
          {match.matchState?.isFreeHit ? (
            <div className="mt-4 rounded-3xl border border-amber-300/30 bg-amber-300/15 px-4 py-3 text-sm font-black uppercase tracking-[0.22em] text-amber-100">
              🔥 FREE HIT
            </div>
          ) : null}
        </div>
      </GlassCard>

      <SectionCard title="Partnership" subtitle="Runs and balls for the batting pair.">
        <div className="grid gap-3">
          <div className="rounded-2xl bg-white/5 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Runs</span>
              <span className="text-2xl font-black text-lime-300">{data.partnership?.runs ?? 0}</span>
            </div>
          </div>
          <div className="rounded-2xl bg-white/5 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Balls</span>
              <span className="text-2xl font-black text-lime-300">{data.partnership?.balls ?? 0}</span>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Striker</p>
              <p className="mt-1 font-bold text-white">{data.partnership?.striker?.name ?? "—"}</p>
              <p className="text-sm text-slate-400">
                {data.partnership?.striker?.runs ?? 0} ({data.partnership?.striker?.balls ?? 0})
              </p>
            </div>
            <div className="rounded-2xl bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Non-striker</p>
              <p className="mt-1 font-bold text-white">{data.partnership?.nonStriker?.name ?? "—"}</p>
              <p className="text-sm text-slate-400">
                {data.partnership?.nonStriker?.runs ?? 0} (
                {data.partnership?.nonStriker?.balls ?? 0})
              </p>
            </div>
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard title="Batting scorecard" subtitle="Name, runs, balls, 4s, 6s, SR">
          <ScoreTable
            headers={["Name", "Runs", "Balls", "4s", "6s", "SR"]}
            rows={recentBatting.map((player: any) => [
              player.name,
              player.runs,
              player.balls,
              player.fours,
              player.sixes,
              Number(player.strikeRate ?? 0).toFixed(2),
            ])}
          />
        </SectionCard>

        <SectionCard title="Bowling scorecard" subtitle="Overs, runs, wickets, economy">
          <ScoreTable
            headers={["Name", "Overs", "Runs", "Wickets", "Economy"]}
            rows={recentBowling.map((player: any) => [
              player.name,
              player.overs,
              player.runs,
              player.wickets,
              Number(player.economy ?? 0).toFixed(2),
            ])}
          />
        </SectionCard>
      </div>
    </div>
  );
}

function ScoreTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: (string | number)[][];
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-white/10">
      <div className="sm:hidden">
        {rows.length ? (
          <div className="divide-y divide-white/10">
            {rows.map((row, rowIndex) => (
              <div key={rowIndex} className="p-4">
                <p className="font-black text-white">{row[0]}</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {headers.slice(1).map((header, headerIndex) => (
                    <div key={header} className="rounded-2xl bg-white/5 p-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
                        {header}
                      </p>
                      <p className="mt-1 text-sm font-bold text-slate-100">
                        {row[headerIndex + 1]}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 text-sm text-slate-400">No scorecard data yet.</div>
        )}
      </div>

      <div className="hidden sm:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-[0.22em] text-slate-400">
            <tr>
              {headers.map((header) => (
                <th key={header} className="px-4 py-3">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-t border-white/10">
                  {row.map((value, cellIndex) => (
                    <td key={`${rowIndex}-${cellIndex}`} className="px-4 py-3 text-slate-200">
                      {value}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-5 text-slate-400" colSpan={headers.length}>
                  No scorecard data yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
