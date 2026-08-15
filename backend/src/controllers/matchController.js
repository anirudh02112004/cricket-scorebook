const Ball = require("../models/Ball");

const Match = require("../models/Match");
const mongoose = require("mongoose");

const Player = require("../models/Player");
const { endMatch, applyPlayerOfMatch } = require("../utils/matchUtils");
const { resolveRunOutState } = require("../utils/deliveryEngine");

const MIN_PLAYERS_PER_TEAM = 5;
const MAX_PLAYERS_PER_TEAM = 11;

function normalizeExtraType(value) {
    const normalized = String(value || "None").replace(/\s+/g, "").toLowerCase();

    if (normalized === "wide") return "Wide";
    if (normalized === "noball") return "NoBall";
    if (normalized === "bye") return "Bye";
    if (normalized === "legbye") return "LegBye";

    return "None";
}

function normalizePlayerRef(value) {
    if (!value) {
        return null;
    }

    if (typeof value === "object") {
        return String(value._id || value.id || "");
    }

    return String(value);
}

function normalizeTeamPlayers(team) {
    if (!team || !Array.isArray(team.players)) {
        return [];
    }

    return team.players.map(normalizePlayerRef).filter(Boolean);
}

function findDuplicateIds(ids) {
    const seen = new Set();
    const duplicates = new Set();

    for (const id of ids) {
        if (seen.has(id)) {
            duplicates.add(id);
        } else {
            seen.add(id);
        }
    }

    return [...duplicates];
}

function buildMatchCreateValidationError(message) {
    return {
        success: false,
        message
    };
}

async function resolvePlayerOfMatch(match) {
    const playerRef = normalizePlayerRef(match?.playerOfMatch);

    if (!playerRef) {
        return null;
    }

    if (typeof match.playerOfMatch === "object" && match.playerOfMatch.name) {
        return {
            _id: playerRef,
            name: match.playerOfMatch.name,
            role: match.playerOfMatch.role || ""
        };
    }

    const player = await Player.findById(playerRef).select("name role");
    if (!player) {
        return null;
    }

    return {
        _id: String(player._id),
        name: player.name,
        role: player.role || ""
    };
}

async function hydrateMatchPlayers(match) {
    if (!match) {
        return null;
    }

    const plainMatch = match.toObject ? match.toObject() : JSON.parse(JSON.stringify(match));
    const ids = new Set();

    const addId = (value) => {
        const id = normalizePlayerRef(value);
        if (id) {
            ids.add(id);
        }
    };

    (plainMatch.teamA?.players || []).forEach(addId);
    (plainMatch.teamB?.players || []).forEach(addId);
    addId(plainMatch.teamA?.captain);
    addId(plainMatch.teamB?.captain);
    addId(plainMatch.matchState?.striker);
    addId(plainMatch.matchState?.nonStriker);
    addId(plainMatch.matchState?.currentBowler);
    addId(plainMatch.playerOfMatch);

    const players = ids.size
        ? await Player.find({ _id: { $in: [...ids] } })
        : [];
    const playerMap = new Map(players.map((player) => [String(player._id), player.toObject()]));

    const resolve = (value) => {
        const id = normalizePlayerRef(value);
        if (!id) {
            return null;
        }

        return playerMap.get(id) || (typeof value === "object" ? value : null);
    };

    plainMatch.teamA.players = (plainMatch.teamA?.players || []).map(resolve).filter(Boolean);
    plainMatch.teamB.players = (plainMatch.teamB?.players || []).map(resolve).filter(Boolean);
    plainMatch.teamA.captain = resolve(plainMatch.teamA?.captain);
    plainMatch.teamB.captain = resolve(plainMatch.teamB?.captain);
    plainMatch.matchState.striker = resolve(plainMatch.matchState?.striker);
    plainMatch.matchState.nonStriker = resolve(plainMatch.matchState?.nonStriker);
    plainMatch.matchState.currentBowler = resolve(plainMatch.matchState?.currentBowler);
    plainMatch.playerOfMatch = resolve(plainMatch.playerOfMatch);

    return plainMatch;
}

function isBowlerDismissal(dismissalType) {
    return ![
        "Run Out",
        "Obstructing the Field",
        "Retired"
    ].includes(String(dismissalType || "").trim());
}

function shuffle(array) {

    for (let i = array.length - 1; i > 0; i--) {

        const j = Math.floor(Math.random() * (i + 1));

        [array[i], array[j]] = [array[j], array[i]];

    }

    return array;
}


function distributePlayers(players, teamA, teamB) {
    for(let i = 0;i<players.length;i++){
        if(i%2===0){
            teamA.push(players[i]);
        }else{
            teamB.push(players[i]);
        }
    }
}

function teamFor(match, side) {
    return side === "A" ? match.teamA : match.teamB;
}

function playerIds(players) {
    return (players || []).map(player => String(player));
}

function isPlayerInTeam(team, playerId) {
    return playerIds(team.players).includes(String(playerId));
}

async function createMatch(req,res){
    try{
        console.log("[match:create] request received");
        console.log("[match:create] authenticated firebaseUid:", req.auth?.firebaseUid || req.user?.firebaseUid || null);
        console.log("[match:create] authenticated player:", req.player ? {
            _id: String(req.player._id),
            name: req.player.name
        } : null);
        console.log("[match:create] request body:", req.body);

        const{
            matchDate,
            tossWinner,
            electedTo,
            teamA,
            teamB,
            totalOvers
        } = req.body || {};

        const normalizedTeamAPlayers = normalizeTeamPlayers(teamA);
        const normalizedTeamBPlayers = normalizeTeamPlayers(teamB);

        if (!teamA || !teamB) {
            return res.status(400).json(buildMatchCreateValidationError("Team A and Team B are required"));
        }

        if (!Array.isArray(teamA.players) || !Array.isArray(teamB.players)) {
            return res.status(400).json(buildMatchCreateValidationError("Team A and Team B must include player arrays"));
        }

        if (normalizedTeamAPlayers.length < MIN_PLAYERS_PER_TEAM || normalizedTeamBPlayers.length < MIN_PLAYERS_PER_TEAM) {
            return res.status(400).json(buildMatchCreateValidationError(`Each team must have at least ${MIN_PLAYERS_PER_TEAM} players`));
        }

        if (normalizedTeamAPlayers.length > MAX_PLAYERS_PER_TEAM || normalizedTeamBPlayers.length > MAX_PLAYERS_PER_TEAM) {
            return res.status(400).json(buildMatchCreateValidationError(`Each team must have no more than ${MAX_PLAYERS_PER_TEAM} players`));
        }

        if (!tossWinner) {
            return res.status(400).json(buildMatchCreateValidationError("Toss winner is required"));
        }

        if (!electedTo) {
            return res.status(400).json(buildMatchCreateValidationError("Toss decision is required"));
        }

        if (!["A", "B"].includes(tossWinner)) {
            return res.status(400).json(buildMatchCreateValidationError("Toss winner must be either A or B"));
        }

        if (!["Batting", "Bowling"].includes(electedTo)) {
            return res.status(400).json(buildMatchCreateValidationError("Toss decision must be either Batting or Bowling"));
        }

        const parsedTotalOvers = Number(totalOvers);
        if (!Number.isInteger(parsedTotalOvers) || parsedTotalOvers < 1) {
            return res.status(400).json(buildMatchCreateValidationError("totalOvers must be a whole number greater than 0"));
        }

        const teamADuplicateIds = findDuplicateIds(normalizedTeamAPlayers);
        if (teamADuplicateIds.length > 0) {
            return res.status(400).json(buildMatchCreateValidationError(`Team A contains duplicate player IDs: ${teamADuplicateIds.join(", ")}`));
        }

        const teamBDuplicateIds = findDuplicateIds(normalizedTeamBPlayers);
        if (teamBDuplicateIds.length > 0) {
            return res.status(400).json(buildMatchCreateValidationError(`Team B contains duplicate player IDs: ${teamBDuplicateIds.join(", ")}`));
        }

        const overlappingPlayerIds = normalizedTeamAPlayers.filter((playerId) =>
            normalizedTeamBPlayers.includes(playerId)
        );

        if (overlappingPlayerIds.length > 0) {
            return res.status(400).json(buildMatchCreateValidationError(`The same player cannot be selected for both teams: ${overlappingPlayerIds.join(", ")}`));
        }

        const allPlayerIds = [...new Set([
            ...normalizedTeamAPlayers,
            ...normalizedTeamBPlayers
        ])];

        const invalidObjectIdPlayerIds = allPlayerIds.filter((playerId) => !mongoose.Types.ObjectId.isValid(playerId));
        if (invalidObjectIdPlayerIds.length > 0) {
            return res.status(400).json(buildMatchCreateValidationError(`Invalid player IDs: ${invalidObjectIdPlayerIds.join(", ")}`));
        }

        const existingPlayers = await Player.find({
            _id: { $in: allPlayerIds },
            isActive: true
        }).select("_id name isActive");

        const existingPlayerIds = new Set(existingPlayers.map((player) => String(player._id)));
        const missingPlayerIds = allPlayerIds.filter((playerId) => !existingPlayerIds.has(playerId));
        if (missingPlayerIds.length > 0) {
            return res.status(400).json(buildMatchCreateValidationError(`Selected players do not exist or are inactive: ${missingPlayerIds.join(", ")}`));
        }

        const parsedMatchDate = matchDate ? new Date(matchDate) : undefined;
        if (matchDate && Number.isNaN(parsedMatchDate.getTime())) {
            return res.status(400).json(buildMatchCreateValidationError("matchDate must be a valid date"));
        }

        console.log("[match:create] Team A:", normalizedTeamAPlayers);
        console.log("[match:create] Team B:", normalizedTeamBPlayers);
        console.log("[match:create] toss winner:", tossWinner);
        console.log("[match:create] toss decision:", electedTo);
        console.log("[match:create] creating match...");

        const match = await Match.create({
            ...(parsedMatchDate ? { matchDate: parsedMatchDate } : {}),
            tossWinner,
            electedTo,
            teamA,
            teamB,
            createdBy: req.user?._id || null,
            rules: {
                maxOvers: parsedTotalOvers
            }
        });
        console.log("[match:create] match saved:", {
            _id: String(match._id),
            createdBy: match.createdBy ? String(match.createdBy) : null,
            status: match.status,
            tossWinner: match.tossWinner,
            electedTo: match.electedTo,
            maxOvers: match.rules?.maxOvers,
            teamAPlayers: (match.teamA?.players || []).map((playerId) => String(playerId)),
            teamBPlayers: (match.teamB?.players || []).map((playerId) => String(playerId))
        });
        console.log("[match:create] returning response:", {
            success: true,
            matchId: String(match._id)
        });
        res.status(201).json({
            success:true,
            message:"Match created successfully",
            matchId:String(match._id),
            match
        });
    } catch (error) {
        console.error("[match:create] failed:", error);
        res.status(500).json({ 
            success:false,
            message: error.message,
            error: error.message
        });
    }
}

async function generateTeams(req,res){
    try{
        const{playerIds}=req.body;
        if(!playerIds || !Array.isArray(playerIds) || playerIds.length<4){
            return res.status(400).json({
                success:false,
                message:"At least 4 player IDs are required to generate a team"
            });
        }
        
        
        const players = await Player.find({
            _id: { $in: playerIds }
        });
        if(players.length !== playerIds.length){
            return res.status(400).json({
                success:false,
                message:"Some players not found"
            });
        }
        const batsmen = [];

        const bowlers = [];

        const allRounders = [];

        const wicketKeepers = [];
        for(const player of players){
            switch(player.role){
                case "Batsman":
                    batsmen.push(player);
                    break;
                case "Bowler":
                    bowlers.push(player);
                    break;
                case "All-Rounder":
                    allRounders.push(player);
                    break;
                case "Wicket-Keeper":
                    wicketKeepers.push(player);
                    break;
                default:
                    return res.status(404).json({
                        success:false,
                        message:'Invalid player role for player ID:'+ player._id
                    });
            }
        }
        shuffle(batsmen);
        shuffle(bowlers);
        shuffle(allRounders);
        shuffle(wicketKeepers);
        const teamA = [];
        const teamB = [];
        distributePlayers(batsmen, teamA, teamB);
        distributePlayers(bowlers, teamA, teamB);
        distributePlayers(allRounders, teamA, teamB);
        distributePlayers(wicketKeepers, teamA, teamB);
        return res.status(200).json({
            success:true,
            teamA,
            teamB
        });

    }catch(error){
        res.status(500).json({
            success:false,
            message:error.message
        });
    }
}

async function getAllMatches(req, res) {
    try {
        console.log("[matches:list] ROUTE HANDLER START");
        console.log("[matches:list] MONGODB QUERY START");
        const matches = await Match.find();
        console.log("[matches:list] MONGODB QUERY COMPLETE", {
            count: matches.length
        });
        console.log("[matches:list] RESPONSE SENT", {
            status: 200
        });

        return res.status(200).json({
            success: true,
            count: matches.length,
            matches
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

async function getMatchById(req, res) {
    try {
        const match = await hydrateMatchPlayers(
            await Match.findById(req.params.matchId)
        );

        if (!match) {
            return res.status(404).json({
                success: false,
                message: "Match not found"
            });
        }

        match.playerOfMatch = await resolvePlayerOfMatch(match);

        return res.status(200).json({
            success: true,
            match
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

async function deleteMatch(req, res) {
    try {
        const match = await Match.findById(req.params.matchId);

        if (!match) {
            return res.status(404).json({
                success: false,
                message: "Match not found"
            });
        }

        if (match.status === "Completed") {
            return res.status(400).json({
                success: false,
                message: "Completed matches cannot be deleted"
            });
        }

        await Ball.deleteMany({ match: match._id });
        await Match.findByIdAndDelete(match._id);

        return res.status(200).json({
            success: true,
            message: "Match deleted successfully"
        });
    } catch (error) {
        console.error("[matches:list] FAILED", {
            message: error.message
        });
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
}


async function startMatch(req, res) {
    try {

        const match = await Match.findById(req.params.matchId);

        if (!match) {
            return res.status(404).json({
                success: false,
                message: "Match not found"
            });
        }

        // Match already started
        if (match.status === "In Progress") {
            return res.status(400).json({
                success: false,
                message: "Match already started"
            });
        }

        const {
            strikerId,
            nonStrikerId,
            bowlerId
        } = req.body || {};

        const isSecondInningsSetup =
            match.matchState.innings === 2 &&
            match.target != null &&
            match.matchState.battingTeam &&
            match.matchState.bowlingTeam;

        // ----------------------------
        // Decide batting & bowling team
        // ----------------------------

        if (!isSecondInningsSetup) {
            if (
                (match.tossWinner === "A" && match.electedTo === "Batting") ||
                (match.tossWinner === "B" && match.electedTo === "Bowling")
            ) {

                match.matchState.battingTeam = "A";
                match.matchState.bowlingTeam = "B";

            } else {

                match.matchState.battingTeam = "B";
                match.matchState.bowlingTeam = "A";

            }
        }

        // ----------------------------
        // Get team objects
        // ----------------------------

        const battingTeam =
            teamFor(match, match.matchState.battingTeam);

        const bowlingTeam =
            teamFor(match, match.matchState.bowlingTeam);

        if (strikerId || nonStrikerId || bowlerId) {
            if (!strikerId || !nonStrikerId || !bowlerId) {
                return res.status(400).json({
                    success: false,
                    message: "Select striker, non-striker, and opening bowler"
                });
            }

            if (
                !isPlayerInTeam(battingTeam, strikerId) ||
                !isPlayerInTeam(battingTeam, nonStrikerId) ||
                strikerId === nonStrikerId
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Opening batsmen must belong to the batting team and be different players"
                });
            }

            if (!isPlayerInTeam(bowlingTeam, bowlerId)) {
                return res.status(400).json({
                    success: false,
                    message: "Opening bowler must belong to the bowling team"
                });
            }

            match.matchState.striker = strikerId;
            match.matchState.nonStriker = nonStrikerId;
            match.matchState.currentBowler = bowlerId;
            match.matchState.nextBatsmanIndex = 2;
        } else {
            return res.status(400).json({
                success: false,
                message: "Select striker, non-striker, and opening bowler"
            });
        }

        // ----------------------------
        // Activate innings
        // ----------------------------

        match.status = "In Progress";
        match.matchState.isFreeHit = false;
        match.matchState.awaitingNextBatsman = false;

        await match.save();

        return res.status(200).json({
            success: true,
            message: "Match Started",
            match
        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }
}

async function getMatchHistory(req, res) {
    try {

        const matches = await Match.find({
            status: "Completed"
        }).sort({ matchDate: -1 });

        const history = [];

        for (const match of matches) {
            const playerOfMatch = await resolvePlayerOfMatch(match);

            history.push({
                _id: match._id,
                date: match.matchDate,
                teamA: match.teamA.teamName,
                teamB: match.teamB.teamName,
                scoreA: `${match.teamA.score}/${match.teamA.wickets}`,
                scoreB: `${match.teamB.score}/${match.teamB.wickets}`,
                winner: match.winner,
                winningMargin: match.winningMargin,
                playerOfMatch,
                target: match.target,
                totalOvers: match.rules.maxOvers,
                status: match.status
            });
        }

        return res.status(200).json({
            success: true,
            count: history.length,
            history
        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }
}

async function changeBowler(req, res) {
    try {

        const { bowlerId } = req.body;

        const match = await Match.findById(req.params.matchId);

        if (!match) {
            return res.status(404).json({
                success: false,
                message: "Match not found"
            });
        }

        if (match.status !== "In Progress") {
            return res.status(400).json({
                success: false,
                message: "Match not in progress"
            });
        }

        let bowlingTeam;

        if (match.matchState.bowlingTeam === "A") {
            bowlingTeam = match.teamA;
        } else {
            bowlingTeam = match.teamB;
        }

        const isBowlerInTeam = bowlingTeam.players.some(
            player => player.toString() === bowlerId
        );

        if (!isBowlerInTeam) {
            return res.status(400).json({
                success: false,
                message: "Selected player is not in bowling team"
            });
        }

        match.matchState.currentBowler = bowlerId;
        await match.save();

        return res.status(200).json({
            success: true,
            message: "Bowler changed",
            match
        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }
}

async function swapBatters(req, res) {
    try {
        const match = await Match.findById(req.params.matchId);

        if (!match) {
            return res.status(404).json({
                success: false,
                message: "Match not found"
            });
        }

        if (match.status !== "In Progress") {
            return res.status(400).json({
                success: false,
                message: "Match not in progress"
            });
        }

        if (!match.matchState.striker || !match.matchState.nonStriker) {
            return res.status(400).json({
                success: false,
                message: "Current striker and non-striker are required"
            });
        }

        const temp = match.matchState.striker;
        match.matchState.striker = match.matchState.nonStriker;
        match.matchState.nonStriker = temp;

        await match.save();

        const populated = await Match.findById(match._id)
            .populate("teamA.players")
            .populate("teamB.players")
            .populate("matchState.striker")
            .populate("matchState.nonStriker")
            .populate("matchState.currentBowler");

        return res.status(200).json({
            success: true,
            message: "Batters swapped",
            match: populated
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

async function selectNextBatsman(req, res) {
    try {
        const { batsmanId } = req.body;

        const match = await Match.findById(req.params.matchId);

        if (!match) {
            return res.status(404).json({
                success: false,
                message: "Match not found"
            });
        }

        if (match.status !== "In Progress") {
            return res.status(400).json({
                success: false,
                message: "Match not in progress"
            });
        }

        if (!match.matchState.awaitingNextBatsman) {
            return res.status(400).json({
                success: false,
                message: "No batsman selection is pending"
            });
        }

        const battingTeam =
            teamFor(match, match.matchState.battingTeam);

        if (!isPlayerInTeam(battingTeam, batsmanId)) {
            return res.status(400).json({
                success: false,
                message: "Selected player is not in batting team"
            });
        }

        if (
            String(match.matchState.striker) === String(batsmanId) ||
            String(match.matchState.nonStriker) === String(batsmanId)
        ) {
            return res.status(400).json({
                success: false,
                message: "Selected player is already on the field"
            });
        }

        const dismissedBalls = await Ball.find({
            match: match._id,
            innings: match.matchState.innings,
            batsman: batsmanId,
            isWicket: true
        }).limit(1);

        if (dismissedBalls.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Selected batsman is already dismissed"
            });
        }

        const lastBall = await Ball.findOne({
            match: match._id,
            innings: match.matchState.innings
        }).sort({
            createdAt: -1
        });

        const normalizedDismissalType = String(lastBall?.dismissalType || "").trim();
        if (normalizedDismissalType === "Run Out") {
            if (!lastBall.dismissedBatsmanPosition) {
                return res.status(400).json({
                    success: false,
                    message: "Run Out dismissal position is missing"
                });
            }

            const runOutState = resolveRunOutState({
                strikerId: match.matchState.striker,
                nonStrikerId: match.matchState.nonStriker,
                dismissedBatsmanPosition: lastBall.dismissedBatsmanPosition,
                runsCompleted: lastBall.runsCompleted ?? lastBall.runsOffBat ?? 0,
                incomingBatsmanId: batsmanId
            });

            match.matchState.striker = runOutState.strikerId;
            match.matchState.nonStriker = runOutState.nonStrikerId;
        } else {
            match.matchState.striker = batsmanId;
        }

        match.matchState.awaitingNextBatsman = false;

        if (match.matchState.nextBatsmanIndex < battingTeam.players.length) {
            const nextIndex = battingTeam.players.findIndex(
                player => String(player) === String(batsmanId)
            );
            if (nextIndex >= 0) {
                match.matchState.nextBatsmanIndex = nextIndex + 1;
            }
        }

        await match.save();

        const populated = await Match.findById(match._id)
            .populate("teamA.players")
            .populate("teamB.players")
            .populate("matchState.striker")
            .populate("matchState.nonStriker")
            .populate("matchState.currentBowler");

        return res.status(200).json({
            success: true,
            message: "Next batsman selected",
            match: populated
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

async function getScoreboard(req, res) {
    try {

        const match = await hydrateMatchPlayers(
            await Match.findById(req.params.matchId)
        );

        if (!match) {
            return res.status(404).json({
                success: false,
                message: "Match not found"
            });
        }

        let battingTeam;

        if (match.matchState.battingTeam === "A") {
            battingTeam = match.teamA;
        } else {
            battingTeam = match.teamB;
        }

        const scoreboard = {
            score: battingTeam.score,
            wickets: battingTeam.wickets,
            overs:
                `${battingTeam.completedOvers}.${battingTeam.ballsInCurrentOver}`,

            striker: match.matchState.striker,

            nonStriker: match.matchState.nonStriker,

            bowler: match.matchState.currentBowler,

            target: match.target,

            innings: match.matchState.innings,

            status: match.status
        };

        return res.status(200).json({
            success: true,
            scoreboard
        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }
}

async function getCurrentOver(req, res) {
    try {

        const match = await Match.findById(req.params.matchId);

        if (!match) {
            return res.status(404).json({
                success: false,
                message: "Match not found"
            });
        }

        let battingTeam;

        if (match.matchState.battingTeam === "A") {
            battingTeam = match.teamA;
        } else {
            battingTeam = match.teamB;
        }

        const currentOver = battingTeam.completedOvers;

        const balls = await Ball.find({
            match: match._id,
            innings: match.matchState.innings,
            over: currentOver
        }).sort({ ball: 1 });

        return res.status(200).json({
            success: true,
            over: currentOver,
            balls
        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }
}

async function getBattingScorecard(req, res) {
    try {

        const match = await hydrateMatchPlayers(
            await Match.findById(req.params.matchId)
        );

        if (!match) {
            return res.status(404).json({
                success: false,
                message: "Match not found"
            });
        }

        let battingTeam;

        if (match.matchState.battingTeam === "A") {
            battingTeam = match.teamA;
        } else {
            battingTeam = match.teamB;
        }

        const scorecard = [];

        for (const player of battingTeam.players) {

            const stats = await Ball.aggregate([

                {
                    $match: {
                        match: match._id,
                        batsman: player._id
                    }
                },

                {
                    $group: {
                        _id: "$batsman",

                        runs: {
                            $sum: "$runsOffBat"
                        },

                        balls: {
                            $sum: {
                                $cond: [
                                    {
                                        $or: [
                                            { $eq: ["$extraType", "Wide"] },
                                            { $eq: ["$extraType", "NoBall"] },
                                            { $eq: ["$extraType", "No Ball"] }
                                        ]
                                    },
                                    0,
                                    1
                                ]
                            }
                        },

                        fours: {
                            $sum: {
                                $cond: [
                                    {
                                        $eq: ["$runsOffBat", 4]
                                    },
                                    1,
                                    0
                                ]
                            }
                        },

                        sixes: {
                            $sum: {
                                $cond: [
                                    {
                                        $eq: ["$runsOffBat", 6]
                                    },
                                    1,
                                    0
                                ]
                            }
                        },

                        out: {
                            $sum: {
                                $cond: [
                                    "$isWicket",
                                    1,
                                    0
                                ]
                            }
                        }

                    }
                }

            ]);

            let batting = {
                name: player.name,
                runs: 0,
                balls: 0,
                fours: 0,
                sixes: 0,
                strikeRate: 0,
                status: "Yet to Bat"
            };

            if (stats.length > 0) {

                batting.runs = stats[0].runs;
                batting.balls = stats[0].balls;
                batting.fours = stats[0].fours;
                batting.sixes = stats[0].sixes;

                batting.strikeRate =
                    batting.balls === 0
                        ? 0
                        : Number(
                            (
                                batting.runs /
                                batting.balls
                            ) * 100
                        ).toFixed(2);

                if (
                    String(match.matchState.striker?._id) ===
                    String(player._id)
                ) {
                    batting.status = "Batting*";
                }
                else if (
                    String(match.matchState.nonStriker?._id) ===
                    String(player._id)
                ) {
                    batting.status = "Batting";
                }
                else if (stats[0].out > 0) {
                    batting.status = "Out";
                }
                else {
                    batting.status = "Not Out";
                }

            }

            scorecard.push(batting);

        }

        return res.status(200).json({
            success: true,
            batting: scorecard
        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }
}

async function getBowlingScorecard(req, res) {
    try {

        const match = await hydrateMatchPlayers(
            await Match.findById(req.params.matchId)
        );

        if (!match) {
            return res.status(404).json({
                success: false,
                message: "Match not found"
            });
        }

        let bowlingTeam;

        if (match.matchState.bowlingTeam === "A") {
            bowlingTeam = match.teamA;
        } else {
            bowlingTeam = match.teamB;
        }

        const scorecard = [];

        for (const player of bowlingTeam.players) {

            const stats = await Ball.aggregate([

                {
                    $match: {
                        match: match._id,
                        bowler: player._id
                    }
                },

                {
                    $group: {
                        _id: "$bowler",

                        legalBalls: {
                            $sum: {
                                $cond: [
                                    {
                                        $or: [
                                            { $eq: ["$extraType", "Wide"] },
                                            { $eq: ["$extraType", "NoBall"] },
                                            { $eq: ["$extraType", "No Ball"] }
                                        ]
                                    },
                                    0,
                                    1
                                ]
                            }
                        },

                        runs: {
                            $sum: {
                                $add: [
                                    "$runsOffBat",
                                    "$extraRuns"
                                ]
                            }
                        },

                        wickets: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            "$isWicket",
                                            {
                                                $ne: [
                                                    "$dismissalType",
                                                    "Run Out"
                                                ]
                                            },
                                            {
                                                $ne: [
                                                    "$dismissalType",
                                                    "Obstructing the Field"
                                                ]
                                            },
                                            {
                                                $ne: [
                                                    "$dismissalType",
                                                    "Retired"
                                                ]
                                            }
                                        ]
                                    },
                                    1,
                                    0
                                ]
                            }
                        }

                    }
                }

            ]);

            let bowling = {
                name: player.name,
                overs: "0.0",
                maidens: 0,
                runs: 0,
                wickets: 0,
                economy: 0,
                status: "Did Not Bowl"
            };

            if (stats.length > 0) {

                const legalBalls = stats[0].legalBalls;

                const completedOvers =
                    Math.floor(legalBalls / 6);

                const remainingBalls =
                    legalBalls % 6;

                bowling.overs =
                    `${completedOvers}.${remainingBalls}`;

                bowling.runs = stats[0].runs;
                bowling.wickets = stats[0].wickets;

                const oversDecimal = legalBalls / 6;

                bowling.economy =
                    oversDecimal === 0
                        ? 0
                        : Number(
                            bowling.runs / oversDecimal
                        ).toFixed(2);

                if (
                    String(match.matchState.currentBowler?._id) ===
                    String(player._id)
                ) {
                    bowling.status = "Bowling";
                }
                else {
                    bowling.status = "Completed";
                }

            }

            scorecard.push(bowling);

        }

        return res.status(200).json({
            success: true,
            bowling: scorecard
        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }
}

async function getCommentary(req, res) {
    try {

        const balls = await Ball.find({
            match: req.params.matchId
        })
            .populate("batsman", "name")
            .populate("bowler", "name")
            .sort({
                innings: 1,
                over: 1,
                ball: 1
            });

        const commentary = balls.map(ball => {

            let text = "";

            if (ball.isWicket) {

                text =
                    `${ball.bowler.name} to ${ball.batsman.name}, OUT`;

                if (ball.dismissalType) {
                    text += ` (${ball.dismissalType})`;
                }

            }

            else if (normalizeExtraType(ball.extraType) === "Wide") {

                text =
                    `${ball.bowler.name} to ${ball.batsman.name}, Wide`;

            }

            else if (normalizeExtraType(ball.extraType) === "NoBall") {

                text =
                    `${ball.bowler.name} to ${ball.batsman.name}, No Ball`;

            }

            else if (ball.runsOffBat === 0) {

                text =
                    `${ball.bowler.name} to ${ball.batsman.name}, Dot Ball`;

            }

            else if (ball.runsOffBat === 4) {

                text =
                    `${ball.bowler.name} to ${ball.batsman.name}, FOUR`;

            }

            else if (ball.runsOffBat === 6) {

                text =
                    `${ball.bowler.name} to ${ball.batsman.name}, SIX`;

            }

            else {

                text =
                    `${ball.bowler.name} to ${ball.batsman.name}, ${ball.runsOffBat} run`;

                if (ball.runsOffBat > 1) {
                    text += "s";
                }

            }

            return {

                innings: ball.innings,

                over: `${ball.over}.${ball.ball}`,

                commentary: text

            };

        });

        return res.status(200).json({

            success: true,

            count: commentary.length,

            commentary

        });

    }

    catch (error) {

        return res.status(500).json({

            success: false,

            message: error.message

        });

    }

}

async function getCurrentPartnership(req, res) {
    try {

        const match = await hydrateMatchPlayers(
            await Match.findById(req.params.matchId)
        );

        if (!match) {
            return res.status(404).json({
                success: false,
                message: "Match not found"
            });
        }

        const striker = match.matchState.striker;
        const nonStriker = match.matchState.nonStriker;

        if (!striker || !nonStriker) {
            return res.status(200).json({
                success: true,
                partnership: {
                    runs: 0,
                    balls: 0,
                    striker: {
                        name: striker?.name || "",
                        runs: 0,
                        balls: 0
                    },
                    nonStriker: {
                        name: nonStriker?.name || "",
                        runs: 0,
                        balls: 0
                    }
                }
            });
        }

        const balls = await Ball.find({
            match: match._id,
            innings: match.matchState.innings
        }).sort({
            over: 1,
            ball: 1,
            createdAt: 1
        });

        let strikerRuns = 0;
        let strikerBalls = 0;

        let nonStrikerRuns = 0;
        let nonStrikerBalls = 0;

        let partnershipRuns = 0;
        let partnershipBalls = 0;

        let partnershipStartIndex = 0;
        for (let index = balls.length - 1; index >= 0; index -= 1) {
            if (balls[index].isWicket) {
                partnershipStartIndex = index + 1;
                break;
            }
        }

        for (const ball of balls.slice(partnershipStartIndex)) {

            if (
                String(ball.batsman) === String(striker._id)
            ) {

                strikerRuns += ball.runsOffBat;

                if (
                    normalizeExtraType(ball.extraType) !== "Wide" &&
                    normalizeExtraType(ball.extraType) !== "NoBall"
                ) {
                    strikerBalls++;
                }

            }

            if (
                String(ball.batsman) === String(nonStriker._id)
            ) {

                nonStrikerRuns += ball.runsOffBat;

                if (
                    normalizeExtraType(ball.extraType) !== "Wide" &&
                    normalizeExtraType(ball.extraType) !== "NoBall"
                ) {
                    nonStrikerBalls++;
                }

            }

            partnershipRuns +=
                ball.runsOffBat + ball.extraRuns;

            if (
                normalizeExtraType(ball.extraType) !== "Wide" &&
                normalizeExtraType(ball.extraType) !== "NoBall"
            ) {
                partnershipBalls++;
            }

        }

        return res.status(200).json({

            success: true,

            partnership: {

                runs: partnershipRuns,

                balls: partnershipBalls,

                striker: {

                    name: striker.name,

                    runs: strikerRuns,

                    balls: strikerBalls

                },

                nonStriker: {

                    name: nonStriker.name,

                    runs: nonStrikerRuns,

                    balls: nonStrikerBalls

                }

            }

        });

    }

    catch (error) {

        return res.status(500).json({

            success: false,

            message: error.message

        });

    }
}



async function getMatchSummary(req, res) {

    try {

        const rawMatch = await Match.findById(req.params.matchId);

        if (!rawMatch) {

            return res.status(404).json({
                success: false,
                message: "Match not found"
            });

        }

        if (rawMatch.status === "Completed" && !rawMatch.playerOfMatch) {
            await applyPlayerOfMatch(rawMatch);
        }

        const match = await hydrateMatchPlayers(rawMatch);
        const playerOfMatch = match.playerOfMatch;

        const balls = await Ball.find({ match: match._id });

        let highestScorer = {
            name: "",
            runs: -1
        };

        const battingStats = {};

        for (const ball of balls) {

            const id = String(ball.batsman);

            if (!battingStats[id]) {

                battingStats[id] = {
                    runs: 0
                };

            }

            battingStats[id].runs += ball.runsOffBat;

        }

        const allPlayers = [...match.teamA.players, ...match.teamB.players];

        for (const player of allPlayers) {

            const stats = battingStats[String(player._id)];

            if (!stats) continue;

            if (stats.runs > highestScorer.runs) {

                highestScorer = {

                    name: player.name,

                    runs: stats.runs

                };

            }

        }

        let bestBowler = {
            name: "",
            wickets: -1,
            runs: 999
        };

        const bowlingStats = {};

        for (const ball of balls) {

            const id = String(ball.bowler);

            if (!bowlingStats[id]) {

                bowlingStats[id] = {

                    wickets: 0,

                    runs: 0

                };

            }

            bowlingStats[id].runs +=
                ball.runsOffBat + ball.extraRuns;

            if (
                ball.isWicket &&
                isBowlerDismissal(ball.dismissalType)
            ) {

                bowlingStats[id].wickets++;

            }

        }

        for (const player of allPlayers) {

            const stats = bowlingStats[String(player._id)];

            if (!stats) continue;

            if (

                stats.wickets > bestBowler.wickets ||

                (

                    stats.wickets === bestBowler.wickets &&

                    stats.runs < bestBowler.runs

                )

            ) {

                bestBowler = {

                    name: player.name,

                    wickets: stats.wickets,

                    runs: stats.runs

                };

            }

        }

        return res.status(200).json({

            success: true,

            summary: {

                status: match.status,

                winner: match.winner,

                winningMargin: match.winningMargin,

                target: match.target,

                teamA: {

                    score: match.teamA.score,

                    wickets: match.teamA.wickets,

                    overs:
                        `${match.teamA.completedOvers}.${match.teamA.ballsInCurrentOver}`

                },

                teamB: {

                    score: match.teamB.score,

                    wickets: match.teamB.wickets,

                    overs:
                        `${match.teamB.completedOvers}.${match.teamB.ballsInCurrentOver}`

                },

                highestScorer,

                bestBowler
                ,
                playerOfMatch

            }

        });

    }

    catch (error) {

        return res.status(500).json({

            success: false,

            message: error.message

        });

    }

}

async function getPlayerOfTheMatch(req, res) {

    try {

        const rawMatch = await Match.findById(req.params.matchId);

        if (!rawMatch) {

            return res.status(404).json({
                success: false,
                message: "Match not found"
            });

        }

        if (rawMatch.status === "Completed" && !rawMatch.playerOfMatch) {
            await applyPlayerOfMatch(rawMatch);
        }

        const match = await hydrateMatchPlayers(rawMatch);
        const resolvedPlayerOfMatch = match.playerOfMatch;

        const balls = await Ball.find({
            match: match._id
        });

        const performance = {};

        function initPlayer(id, name, role) {

            if (!performance[id]) {

                performance[id] = {

                    playerId: id,

                    name,

                    role: role || "",

                    runs: 0,

                    balls: 0,

                    fours: 0,

                    sixes: 0,

                    wickets: 0,

                    catches: 0,

                    runOuts: 0,

                    score: 0

                };

            }

        }

        const allPlayers = [
            ...match.teamA.players,
            ...match.teamB.players
        ];

        allPlayers.forEach(player => {

            initPlayer(
                String(player._id),
                player.name,
                player.role
            );

        });

        for (const ball of balls) {

            const batsmanId = String(ball.batsman);

            performance[batsmanId].runs += ball.runsOffBat;

            if (ball.extraType !== "Wide") {

                performance[batsmanId].balls++;

            }

            if (ball.runsOffBat === 4) {

                performance[batsmanId].fours++;

            }

            if (ball.runsOffBat === 6) {

                performance[batsmanId].sixes++;

            }

            const bowlerId = String(ball.bowler);

            if (

                ball.isWicket &&

                isBowlerDismissal(ball.dismissalType)

            ) {

                performance[bowlerId].wickets++;

            }

            if (ball.fielder) {

                const fielderId = String(ball.fielder);

                initPlayer(fielderId, "", "");

                if (ball.dismissalType === "Caught") {

                    performance[fielderId].catches++;

                }

                if (ball.dismissalType === "Run Out") {

                    performance[fielderId].runOuts++;

                }

                if (ball.dismissalType === "Obstructing the Field") {

                    performance[fielderId].runOuts++;

                }

            }

        }

        Object.values(performance).forEach(player => {

            player.score =

                player.runs +

                player.fours +

                (player.sixes * 2) +

                (player.wickets * 25) +

                (player.catches * 8) +

                (player.runOuts * 10);

        });

        const topPerformancePlayer =
            match.playerOfMatch && performance[String(match.playerOfMatch._id || match.playerOfMatch)]
                ? performance[String(match.playerOfMatch._id || match.playerOfMatch)]
                : null;

        const playerOfTheMatch =
            resolvedPlayerOfMatch ||
            topPerformancePlayer ||
            Object.values(performance)
                .sort((a, b) => b.score - a.score)[0];

        return res.status(200).json({

            success: true,

            playerOfMatch: playerOfTheMatch,
            playerOfTheMatch

        });

    }

    catch (error) {

        return res.status(500).json({

            success: false,

            message: error.message

        });

    }

}







    
module.exports = {
    createMatch,
    getAllMatches,
    getMatchById,
    generateTeams,
    deleteMatch,
    startMatch,
    changeBowler,
    swapBatters,
    selectNextBatsman,
    getScoreboard,
    getCurrentOver,
    getBattingScorecard,
    getBowlingScorecard,
    getCommentary,
    getCurrentPartnership,
    getMatchSummary,
    getMatchHistory,
    getPlayerOfTheMatch
};
