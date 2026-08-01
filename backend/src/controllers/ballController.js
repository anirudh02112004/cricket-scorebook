const Ball = require("../models/Ball");
const Match = require("../models/Match");
const Player = require("../models/Player");
const { endMatch } = require("../utils/matchUtils");

function normalizeExtraType(value) {
    const normalized = String(value || "None").replace(/\s+/g, "").toLowerCase();

    if (normalized === "wide") return "Wide";
    if (normalized === "noball") return "NoBall";
    if (normalized === "bye") return "Bye";
    if (normalized === "legbye") return "LegBye";

    return "None";
}

function normalizeDismissalType(value) {
    return String(value || "").trim();
}

function isLegalDelivery(extraType) {
    return extraType !== "Wide" && extraType !== "NoBall";
}

function isBowlerDismissal(dismissalType) {
    return ![
        "Run Out",
        "Obstructing the Field",
        "Retired"
    ].includes(normalizeDismissalType(dismissalType));
}

function isAllowedNoBallDismissal(dismissalType) {
    return [
        "Run Out",
        "Obstructing the Field",
        "Retired"
    ].includes(normalizeDismissalType(dismissalType));
}

const endInnings = async (match) => {
    const currentBattingSide = match.matchState.battingTeam === "A" ? "A" : "B";
    const currentBattingTeam = currentBattingSide === "A" ? match.teamA : match.teamB;
    const nextBattingSide = currentBattingSide === "A" ? "B" : "A";
    const nextBattingTeam = nextBattingSide === "A" ? match.teamA : match.teamB;

    // ==========================
    // END OF FIRST INNINGS
    // ==========================
    if (match.matchState.innings === 1) {
        match.target = currentBattingTeam.score + 1;

        match.matchState.innings = 2;
        match.matchState.battingTeam = nextBattingSide;
        match.matchState.bowlingTeam = currentBattingSide;
        match.matchState.striker = null;
        match.matchState.nonStriker = null;
        match.matchState.currentBowler = null;
        match.matchState.awaitingNextBatsman = false;
        match.matchState.nextBatsmanIndex = 2;
        match.matchState.isFreeHit = false;
        match.status = "Scheduled";

        nextBattingTeam.score = 0;
        nextBattingTeam.wickets = 0;
        nextBattingTeam.completedOvers = 0;
        nextBattingTeam.ballsInCurrentOver = 0;
        nextBattingTeam.extras = {
            wides: 0,
            noBalls: 0,
            byes: 0,
            legByes: 0
        };

    }

    // ==========================
    // END OF SECOND INNINGS
    // ==========================
    else {

        match.status = "Completed";
        match.matchState.isFreeHit = false;
        match.matchState.awaitingNextBatsman = false;
        match.matchState.currentBowler = null;
        match.matchState.striker = null;
        match.matchState.nonStriker = null;

        if (match.teamB.score >= match.target) {

            match.winner = "B";
            match.winningMargin =
                `${match.teamB.players.length - 1 - match.teamB.wickets} wickets`;

        }
        else if (match.teamB.score === match.target - 1) {

            match.winner = "Tie";
            match.winningMargin = "Match Tied";

        }
        else {

            match.winner = "A";
            match.winningMargin =
                `${match.target - match.teamB.score - 1} runs`;

        }

    }

    await match.save();
};
async function scoreBall(req, res) {
    try {
        let {
            matchId,
            runsOffBat,
            extraType,
            extraRuns,
            isWicket,
            dismissalType,
            fielder,
            isBouncer,
            noBallReason
        } = req.body;
        runsOffBat = runsOffBat || 0;
        extraRuns = extraRuns || 0;
        isWicket = isWicket || false;
        extraType = normalizeExtraType(extraType);
        const match = await Match.findById(matchId);
        if(!match){
            return res.status(404).json({
                success:false,
                message:"Match not found"
            });
        }
        if (match.status === "Completed") {
            return res.status(400).json({
                success: false,
                message: "Cannot score a completed match"
            });
        }
        if (match.matchState.awaitingNextBatsman) {
            return res.status(400).json({
                success: false,
                message: "Select next batsman before scoring the next ball"
            });
        }
        if (!match.matchState.currentBowler) {
            return res.status(400).json({
                success: false,
                message: "Select an opening bowler before scoring"
            });
        }
        
        const wasFreeHit = Boolean(match.matchState.isFreeHit);
        let battingTeam;

        if (match.matchState.battingTeam === "A") {
            battingTeam = match.teamA;
        } else {
            battingTeam = match.teamB;
        }
        const over = battingTeam.completedOvers;
        const ball = battingTeam.ballsInCurrentOver + 1;


        let bowlingTeam;

        if (match.matchState.bowlingTeam === "A") {
            bowlingTeam = match.teamA;
        } else {
            bowlingTeam = match.teamB;
        }
        const bouncerCount = await Ball.countDocuments({
            match: match._id,
            innings: match.matchState.innings,
            over: over,
            isBouncer: true
        });
        if (isBouncer && bouncerCount >= 1) {
            extraType = "NoBall";
            extraRuns = 1;
            noBallReason = "Second Bouncer";
        }
        if (noBallReason === "Height") {
            extraType = "NoBall";
            extraRuns = 1;
        }

        if (noBallReason === "Overstep") {
            extraType = "NoBall";
            extraRuns = 1;
        }

        if (
            (wasFreeHit || extraType === "NoBall") &&
            isWicket &&
            !isAllowedNoBallDismissal(dismissalType)
        ) {
            isWicket = false;
            dismissalType = null;
        }

        const nextFreeHit = extraType === "NoBall";

        const batsman = await Player.findById(match.matchState.striker);
        if (!batsman) {
            return res.status(404).json({
                success:false,
                message:"Batsman not found"
            });
        }

        const bowler = await Player.findById(match.matchState.currentBowler);
        if (!bowler) {
            return res.status(404).json({
                success: false,
                message: "Bowler not found"
            });
        }
        
        const ballRecord = await Ball.create({
            match: match._id,
            innings: match.matchState.innings,
            over,
            ball,
            batsman:match.matchState.striker,
            bowler:match.matchState.currentBowler,
            nonStriker:match.matchState.nonStriker,
            fielder,
            runsOffBat:runsOffBat,
            extraType,
            extraRuns,
            isWicket,
            dismissalType,
            isBouncer,
            noBallReason,
            isFreeHit: wasFreeHit,
            isLegalDelivery: isLegalDelivery(extraType),
            totalRuns: runsOffBat + extraRuns,
            creditedToBowler: isWicket && isBowlerDismissal(dismissalType)

        });
        battingTeam.score += runsOffBat + extraRuns;

        battingTeam.extras = battingTeam.extras || {};
        if (extraType === "Wide") {
            battingTeam.extras.wides = (battingTeam.extras.wides || 0) + extraRuns;
        }
        if (extraType === "NoBall") {
            battingTeam.extras.noBalls = (battingTeam.extras.noBalls || 0) + extraRuns;
        }
        if (extraType === "Bye") {
            battingTeam.extras.byes = (battingTeam.extras.byes || 0) + extraRuns;
        }
        if (extraType === "LegBye") {
            battingTeam.extras.legByes = (battingTeam.extras.legByes || 0) + extraRuns;
        }

        if (match.matchState.innings === 2 && match.target && battingTeam.score >= match.target) {
            await endMatch(match);

            return res.status(201).json({
                success: true,
                message: "Match completed",
                ball: ballRecord
            });
        }

        const totalRunsThisBall = runsOffBat + extraRuns;

       

        if (totalRunsThisBall % 2 !== 0) {
            const temp = match.matchState.striker;
            match.matchState.striker = match.matchState.nonStriker;
            match.matchState.nonStriker = temp;
        }
        // Legal delivery
        if (isLegalDelivery(extraType)) {
            battingTeam.ballsInCurrentOver++;
        }

        
        
        
        if (isWicket) {
            battingTeam.wickets++;

            switch (dismissalType) {

                case "Bowled":
                case "Caught":
                case "Stumped":
                case "Hit Wicket":
                    break;

                case "Run Out":
                case "Obstructing the Field":
                case "Retired":
                    // Bowler doesn't get a wicket
                    break;

                case "LBW":
                    return res.status(400).json({
                        success: false,
                        message: "LBW is disabled for this match."
                    });

            }
            if (battingTeam.wickets < battingTeam.players.length - 1) {
                match.matchState.awaitingNextBatsman = true;
            } else {
                match.matchState.awaitingNextBatsman = false;
            }

        }
        

       

        if (battingTeam.wickets === battingTeam.players.length - 1) {
            if (match.matchState.innings === 1) {
                await endInnings(match);
            } else {
                await endMatch(match);
            }
            await match.save();

            return res.status(201).json({
                success: true,
                message: "Innings ended successfully",
                ball: ballRecord
            });
        }



        if (battingTeam.ballsInCurrentOver === 6) {

            battingTeam.completedOvers++;
            battingTeam.ballsInCurrentOver = 0;

            const temp = match.matchState.striker;
            match.matchState.striker = match.matchState.nonStriker;
            match.matchState.nonStriker = temp;

            match.matchState.currentBowler = null;

            if (battingTeam.completedOvers >= match.rules.maxOvers) {
                if (match.matchState.innings === 1) {
                    await endInnings(match);
                } else {
                    await endMatch(match);
                }

                await match.save();

                return res.status(201).json({
                    success: true,
                    message: "Innings ended successfully",
                    ball: ballRecord
                });
            }
        }

        

        
        if (battingTeam.completedOvers >= match.rules.maxOvers) {
            await endMatch(match);
        }
        match.matchState.isFreeHit = nextFreeHit;

        
        
        await match.save();
        return res.status(201).json({
            success: true,
            message: "Ball recorded successfully",
            ball: ballRecord
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

async function undoLastBall(req, res) {

    try {

        const match = await Match.findById(req.params.matchId);

        if (!match) {

            return res.status(404).json({

                success:false,

                message:"Match not found"

            });

        }
        if (match.status === "Completed") {
            return res.status(400).json({
                success: false,
                message: "Cannot undo a completed match"
            });
        }

        const lastBall = await Ball.findOne({

            match: match._id

        }).sort({

            createdAt:-1

        });

        if(!lastBall){

            return res.status(400).json({

                success:false,

                message:"No ball available to undo"

            });

        }
        let battingTeam;

        if(match.matchState.battingTeam==="A"){

            battingTeam=match.teamA;

        }else{

            battingTeam=match.teamB;

        }

        battingTeam.score -= lastBall.runsOffBat + lastBall.extraRuns;
        if(

            lastBall.extraType!=="Wide" &&

            normalizeExtraType(lastBall.extraType)!=="NoBall"

        ){

            battingTeam.ballsInCurrentOver--;

            if(battingTeam.ballsInCurrentOver<0){

                battingTeam.completedOvers--;

                battingTeam.ballsInCurrentOver=5;

            }

        }
        if(lastBall.isWicket){

            battingTeam.wickets--;
            match.matchState.awaitingNextBatsman = false;
        }
        await Ball.findByIdAndDelete(lastBall._id);

        const previousBall = await Ball.findOne({
            match: match._id,
            innings: match.matchState.innings
        }).sort({
            createdAt: -1
        });

        match.matchState.isFreeHit =
            previousBall && normalizeExtraType(previousBall.extraType) === "NoBall";

        await match.save();

        return res.status(200).json({

            success:true,

            message:"Last ball undone"

        });

    }

    catch(error){

        return res.status(500).json({

        success:false,

        message:error.message

        });

    }

}




module.exports = {
    scoreBall,
    undoLastBall
};
