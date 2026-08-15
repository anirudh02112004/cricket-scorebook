const express = require("express");
const router = express.Router();


const {
    createMatch,
    getAllMatches,
    getMatchById,
    generateTeams,
    startMatch,
    changeBowler,
    getScoreboard,
    getCurrentOver,
    getBattingScorecard,
    getBowlingScorecard,
    getCommentary,
    getCurrentPartnership,
    getMatchSummary,
    getMatchHistory,
    getPlayerOfTheMatch,
    deleteMatch,
    selectNextBatsman,
    swapBatters
} = require("../controllers/matchController");
const authMiddleware = require("../middleware/authMiddleware");




router.post("/", authMiddleware, createMatch);

router.post("/generate-teams", authMiddleware, generateTeams);

router.get("/", getAllMatches);

router.get("/:matchId/scoreboard", getScoreboard);

router.get("/:matchId/current-over", getCurrentOver);

router.get("/:matchId/batting", getBattingScorecard);

router.get("/:matchId/bowling", getBowlingScorecard);

router.get("/:matchId/commentary", getCommentary);

router.get("/:matchId/partnership", getCurrentPartnership);

router.get("/:matchId/summary", getMatchSummary);

router.get("/history", getMatchHistory);

router.get(
    "/:matchId/player-of-the-match",
    getPlayerOfTheMatch
);

router.get("/:matchId", getMatchById);

router.delete("/:matchId", authMiddleware, deleteMatch);

router.patch("/:matchId/start", authMiddleware, startMatch);

router.patch("/:matchId/change-bowler", authMiddleware, changeBowler);

router.patch("/:matchId/swap-batters", authMiddleware, swapBatters);

router.patch("/:matchId/select-next-batsman", authMiddleware, selectNextBatsman);

module.exports = router;
