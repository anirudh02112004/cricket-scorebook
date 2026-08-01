const Ball = require("../models/Ball");
const Player = require("../models/Player");

function normalizeExtraType(value) {
    const normalized = String(value || "None").replace(/\s+/g, "").toLowerCase();

    if (normalized === "wide") return "Wide";
    if (normalized === "noball") return "NoBall";
    if (normalized === "bye") return "Bye";
    if (normalized === "legbye") return "LegBye";

    return "None";
}

function isBowlerDismissal(dismissalType) {
    return ![
        "Run Out",
        "Obstructing the Field",
        "Retired"
    ].includes(String(dismissalType || "").trim());
}

function normalizeDismissalType(value) {
    return String(value || "").trim();
}

function buildPlayerOfMatch(match, balls, players) {
    const playerMap = new Map(players.map((player) => [String(player._id), player]));
    const teamAIds = new Set((match.teamA?.players || []).map((player) => String(player)));
    const teamBIds = new Set((match.teamB?.players || []).map((player) => String(player)));

    const statsMap = new Map();

    const ensureStats = (playerId) => {
        if (!statsMap.has(playerId)) {
            statsMap.set(playerId, {
                batting: { runs: 0, balls: 0, fours: 0, sixes: 0 },
                bowling: { legalBalls: 0, runs: 0, wickets: 0 },
                fielding: { catches: 0, runOuts: 0, stumpings: 0 }
            });
        }
        return statsMap.get(playerId);
    };

    for (const ball of balls) {
        const batsmanId = String(ball.batsman);
        const bowlerId = String(ball.bowler);
        const fielderId = ball.fielder ? String(ball.fielder) : null;
        const extraType = normalizeExtraType(ball.extraType);

        const batting = ensureStats(batsmanId);
        batting.batting.runs += ball.runsOffBat || 0;
        if (extraType !== "Wide") {
            batting.batting.balls += 1;
        }
        if ((ball.runsOffBat || 0) === 4) batting.batting.fours += 1;
        if ((ball.runsOffBat || 0) === 6) batting.batting.sixes += 1;

        const bowling = ensureStats(bowlerId);
        bowling.bowling.legalBalls += extraType === "Wide" || extraType === "NoBall" ? 0 : 1;
        bowling.bowling.runs += (ball.runsOffBat || 0) + (ball.extraRuns || 0);
        if (ball.isWicket && isBowlerDismissal(ball.dismissalType)) {
            bowling.bowling.wickets += 1;
        }

        if (fielderId) {
            const fielding = ensureStats(fielderId);
            if (normalizeDismissalType(ball.dismissalType) === "Caught") {
                fielding.fielding.catches += 1;
            }
            if (normalizeDismissalType(ball.dismissalType) === "Run Out") {
                fielding.fielding.runOuts += 1;
            }
            if (normalizeDismissalType(ball.dismissalType) === "Stumped") {
                fielding.fielding.stumpings += 1;
            }
        }
    }

    const winningTeamIds =
        match.winner === "A"
            ? teamAIds
            : match.winner === "B"
                ? teamBIds
                : null;

    let winningTeamTopRuns = 0;
    if (winningTeamIds) {
        for (const [playerId, stats] of statsMap.entries()) {
            if (winningTeamIds.has(playerId)) {
                winningTeamTopRuns = Math.max(winningTeamTopRuns, stats.batting.runs);
            }
        }
    }

    let bestPlayer = null;
    let bestScore = -Infinity;

    for (const [playerId, stats] of statsMap.entries()) {
        const player = playerMap.get(playerId);
        if (!player) continue;

        const battingStrikeRate =
            stats.batting.balls > 0
                ? (stats.batting.runs / stats.batting.balls) * 100
                : 0;
        const bowlingOvers = stats.bowling.legalBalls / 6;
        const bowlingEconomy =
            bowlingOvers > 0 ? stats.bowling.runs / bowlingOvers : 0;

        let impactScore = 0;
        impactScore += stats.batting.runs * 4;
        impactScore += battingStrikeRate * 0.3;
        impactScore += stats.bowling.wickets * 35;
        impactScore += Math.max(0, 12 - bowlingEconomy) * 4;
        impactScore += stats.fielding.catches * 10;
        impactScore += stats.fielding.runOuts * 15;
        impactScore += stats.fielding.stumpings * 15;

        if (winningTeamIds && winningTeamIds.has(playerId)) {
            impactScore += 100;
        }

        if (
            winningTeamIds &&
            winningTeamIds.has(playerId) &&
            stats.batting.runs > 0 &&
            stats.batting.runs === winningTeamTopRuns
        ) {
            impactScore += 120;
        }

        if (
            winningTeamIds &&
            winningTeamIds.has(playerId) &&
            (stats.batting.runs > 0 || stats.bowling.wickets > 0 || stats.fielding.catches > 0)
        ) {
            impactScore += 40;
        }

        if (impactScore > bestScore) {
            bestScore = impactScore;
            bestPlayer = {
                playerId,
                name: player.name,
                role: player.role,
                score: impactScore,
                batting: {
                    runs: stats.batting.runs,
                    balls: stats.batting.balls,
                    strikeRate: battingStrikeRate.toFixed(2)
                },
                bowling: {
                    wickets: stats.bowling.wickets,
                    economy: bowlingEconomy.toFixed(2)
                },
                fielding: stats.fielding
            };
        }
    }

    return bestPlayer;
}

function ensureCareerShape(player) {
    player.career = player.career || {};
    player.career.batting = player.career.batting || {};
    player.career.bowling = player.career.bowling || {};
    player.career.fielding = player.career.fielding || {};

    player.career.batting.matches = player.career.batting.matches || 0;
    player.career.batting.innings = player.career.batting.innings || 0;
    player.career.batting.runs = player.career.batting.runs || 0;
    player.career.batting.ballsFaced = player.career.batting.ballsFaced || 0;
    player.career.batting.highestScore = player.career.batting.highestScore || 0;
    player.career.batting.fours = player.career.batting.fours || 0;
    player.career.batting.sixes = player.career.batting.sixes || 0;
    player.career.batting.notOuts = player.career.batting.notOuts || 0;
    player.career.batting.average = player.career.batting.average || 0;
    player.career.batting.strikeRate = player.career.batting.strikeRate || 0;
    player.career.bowling.matches = player.career.bowling.matches || 0;
    player.career.bowling.innings = player.career.bowling.innings || 0;
    player.career.bowling.ballsBowled = player.career.bowling.ballsBowled || 0;
    player.career.bowling.runsConceded = player.career.bowling.runsConceded || 0;
    player.career.bowling.wickets = player.career.bowling.wickets || 0;
    player.career.bowling.economy = player.career.bowling.economy || 0;
    player.career.bowling.average = player.career.bowling.average || 0;
    player.career.bowling.bestFigures = player.career.bowling.bestFigures || {
        wickets: 0,
        runs: 0
    };

    player.career.fielding.catches = player.career.fielding.catches || 0;
    player.career.fielding.runOuts = player.career.fielding.runOuts || 0;
    player.career.fielding.stumpings = player.career.fielding.stumpings || 0;

    player.fifties = player.fifties || 0;
    player.hundreds = player.hundreds || 0;
}

function buildBaseStats() {
    return {
        batting: {
            runs: 0,
            balls: 0,
            fours: 0,
            sixes: 0,
            dismissals: 0
        },
        bowling: {
            legalBalls: 0,
            runs: 0,
            wickets: 0
        },
        fielding: {
            catches: 0,
            runOuts: 0,
            stumpings: 0
        }
    };
}

async function applyCareerStatsFromMatch(match) {
    if (match.careerProcessed) {
        return match;
    }

    const balls = await Ball.find({ match: match._id });
    const playerIds = [
        ...(match.teamA?.players || []),
        ...(match.teamB?.players || [])
    ].map(player => String(player));

    const uniquePlayerIds = [...new Set(playerIds)];
    const players = await Player.find({ _id: { $in: uniquePlayerIds } });
    const playerMap = new Map(players.map(player => [String(player._id), player]));
    const statsMap = new Map();

    for (const ball of balls) {
        const batsmanId = String(ball.batsman);
        const bowlerId = String(ball.bowler);
        const fielderId = ball.fielder ? String(ball.fielder) : null;
        const extraType = normalizeExtraType(ball.extraType);

        if (!statsMap.has(batsmanId)) {
            statsMap.set(batsmanId, buildBaseStats());
        }
        if (!statsMap.has(bowlerId)) {
            statsMap.set(bowlerId, buildBaseStats());
        }
        if (fielderId && !statsMap.has(fielderId)) {
            statsMap.set(fielderId, buildBaseStats());
        }

        const batting = statsMap.get(batsmanId);
        batting.batting.runs += ball.runsOffBat || 0;
        if (extraType !== "Wide") {
            batting.batting.balls += 1;
        }
        if ((ball.runsOffBat || 0) === 4) batting.batting.fours += 1;
        if ((ball.runsOffBat || 0) === 6) batting.batting.sixes += 1;
        if (ball.isWicket) batting.batting.dismissals += 1;

        const bowling = statsMap.get(bowlerId);
        bowling.bowling.legalBalls += extraType === "Wide" || extraType === "NoBall" ? 0 : 1;
        bowling.bowling.runs += (ball.runsOffBat || 0) + (ball.extraRuns || 0);
        if (ball.isWicket && isBowlerDismissal(ball.dismissalType)) {
            bowling.bowling.wickets += 1;
        }

        if (fielderId) {
            const fielding = statsMap.get(fielderId);
            if (ball.dismissalType === "Caught") {
                fielding.fielding.catches += 1;
            }
            if (ball.dismissalType === "Run Out") {
                fielding.fielding.runOuts += 1;
            }
            if (ball.dismissalType === "Stumped") {
                fielding.fielding.stumpings += 1;
            }
        }
    }

    for (const playerId of uniquePlayerIds) {
        const player = playerMap.get(playerId);
        if (!player) continue;

        ensureCareerShape(player);

        player.career.batting.matches += 1;
        player.career.bowling.matches += 1;

        const stats = statsMap.get(playerId);
        if (stats) {
            if (stats.batting.runs > 0 || stats.batting.balls > 0 || stats.batting.dismissals > 0) {
                player.career.batting.innings += 1;
                player.career.batting.runs += stats.batting.runs;
                player.career.batting.ballsFaced += stats.batting.balls;
                player.career.batting.fours += stats.batting.fours;
                player.career.batting.sixes += stats.batting.sixes;
                if (stats.batting.dismissals === 0) {
                    player.career.batting.notOuts += 1;
                }
                if (stats.batting.runs > player.career.batting.highestScore) {
                    player.career.batting.highestScore = stats.batting.runs;
                }
                if (stats.batting.runs === 0 && stats.batting.dismissals > 0) {
                    player.ducks = (player.ducks || 0) + 1;
                }
                if (stats.batting.runs >= 100) {
                    player.hundreds = (player.hundreds || 0) + 1;
                } else if (stats.batting.runs >= 50) {
                    player.fifties = (player.fifties || 0) + 1;
                }
            }

            if (stats.bowling.legalBalls > 0) {
                player.career.bowling.innings += 1;
                player.career.bowling.ballsBowled += stats.bowling.legalBalls;
                player.career.bowling.runsConceded += stats.bowling.runs;
                player.career.bowling.wickets += stats.bowling.wickets;
                if (stats.bowling.wickets > player.career.bowling.bestFigures.wickets ||
                    (
                        stats.bowling.wickets === player.career.bowling.bestFigures.wickets &&
                        stats.bowling.runs < player.career.bowling.bestFigures.runs
                    )) {
                    player.career.bowling.bestFigures = {
                        wickets: stats.bowling.wickets,
                        runs: stats.bowling.runs
                    };
                }
            }

            player.career.fielding.catches += stats.fielding.catches;
            player.career.fielding.runOuts += stats.fielding.runOuts;
            player.career.fielding.stumpings += stats.fielding.stumpings;
        }

        const battingDismissals = player.career.batting.innings - player.career.batting.notOuts;
        player.career.batting.average =
            battingDismissals > 0
                ? player.career.batting.runs / battingDismissals
                : player.career.batting.runs;
        player.career.batting.strikeRate =
            player.career.batting.ballsFaced > 0
                ? (player.career.batting.runs / player.career.batting.ballsFaced) * 100
                : 0;

        const bowlingOvers = player.career.bowling.ballsBowled / 6;
        player.career.bowling.economy =
            bowlingOvers > 0
                ? player.career.bowling.runsConceded / bowlingOvers
                : 0;
        player.career.bowling.average =
            player.career.bowling.wickets > 0
                ? player.career.bowling.runsConceded / player.career.bowling.wickets
                : 0;

        await player.save();
    }

    match.careerProcessed = true;
    await match.save();
    return match;
}

async function applyPlayerOfMatch(match) {
    const balls = await Ball.find({ match: match._id });
    const playerIds = [
        ...(match.teamA?.players || []),
        ...(match.teamB?.players || [])
    ].map((player) => String(player));
    const uniquePlayerIds = [...new Set(playerIds)];
    const players = await Player.find({ _id: { $in: uniquePlayerIds } });
    const award = buildPlayerOfMatch(match, balls, players);

    match.playerOfMatch = award ? award.playerId : null;
    await match.save();

    return {
        match,
        playerOfMatch: award
    };
}

async function endMatch(match) {
    if (match.careerProcessed) {
        return match;
    }

    await applyCareerStatsFromMatch(match);

    match.status = "Completed";

    if (match.teamA.score > match.teamB.score) {
        match.winner = "A";
        match.winningMargin = `${match.teamA.score - match.teamB.score} runs`;
    } else if (match.teamB.score > match.teamA.score) {
        match.winner = "B";
        match.winningMargin = `${match.teamB.score - match.teamA.score} runs`;
    } else {
        match.winner = "Tie";
        match.winningMargin = "Match Tied";
    }

    await applyPlayerOfMatch(match);
    await match.save();
    return match;
}

module.exports = {
    endMatch,
    applyCareerStatsFromMatch,
    applyPlayerOfMatch,
    normalizeExtraType
};
