export interface DashboardStats {
  totalPlayers: number;
  totalMatches: number;
  completedMatches: number;
  liveMatches: number;
}

export interface DashboardResponse {
  success: boolean;
  dashboard: {
    liveMatch: any;
    stats: DashboardStats;
    recentMatches: any[];
    topRunScorer: any;
    topWicketTaker: any;
  };
}