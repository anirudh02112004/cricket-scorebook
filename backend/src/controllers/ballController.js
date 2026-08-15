const Ball = require("../models/Ball");
const Match = require("../models/Match");
const Player = require("../models/Player");
const { endMatch } = require("../utils/matchUtils");
const {
    buildCommentary,
    DismissedBatsmanPositions,
    isLegalDelivery,
    normalizeDismissedBatsmanPosition,
    normalizeExtraType,
    normalizeNoBallReason,
    resolveRunOutState
} = require("../utils/deliveryEngine");

function normalizeDismissalType(value) {
    return String(value || "").trim();
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
            noBallReason,
            dismissedBatsmanPosition
        } = req.body;
        runsOffBat = runsOffBat || 0;
        extraRuns = extraRuns || 0;
        isWicket = isWicket || false;
        extraType = normalizeExtraType(extraType);
        noBallReason = normalizeNoBallReason(noBallReason);
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
            noBallReason = "SECOND_BOUNCER";
        }
        if (noBallReason === "HEIGHT") {
            extraType = "NoBall";
            extraRuns = 1;
        }

        if (noBallReason === "OVERSTEP") {
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

        const normalizedDismissalType = normalizeDismissalType(dismissalType);
        const isRunOut = normalizedDismissalType === "Run Out";
        const normalizedDismissedBatsmanPosition = isRunOut
            ? normalizeDismissedBatsmanPosition(dismissedBatsmanPosition)
            : null;

        if (isRunOut && !normalizedDismissedBatsmanPosition) {
            return res.status(400).json({
                success: false,
                message: "Select whether the striker or non-striker was run out"
            });
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

        const nonStriker = match.matchState.nonStriker
            ? await Player.findById(match.matchState.nonStriker)
            : null;

        const resolvedRunOutState = isRunOut
            ? resolveRunOutState({
                strikerId: match.matchState.striker,
                nonStrikerId: match.matchState.nonStriker,
                dismissedBatsmanPosition: normalizedDismissedBatsmanPosition,
                runsCompleted: Number(runsOffBat || 0)
            })
            : null;

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
            dismissedBatsman:
                resolvedRunOutState?.dismissedBatsmanId || null,
            dismissedBatsmanPosition: normalizedDismissedBatsmanPosition,
            runsCompleted: isRunOut ? Number(runsOffBat || 0) : 0,
            battersCrossed: isRunOut ? Number(runsOffBat || 0) % 2 === 1 : false,
            isFreeHit: wasFreeHit,
            isLegalDelivery: isLegalDelivery(extraType),
            totalRuns: runsOffBat + extraRuns,
            creditedToBowler: isWicket && isBowlerDismissal(dismissalType)

        });

        const sendScoreResponse = async (message) => {
            const [currentStriker, currentNonStriker, currentBowler] = await Promise.all([
                match.matchState.striker ? Player.findById(match.matchState.striker) : null,
                match.matchState.nonStriker ? Player.findById(match.matchState.nonStriker) : null,
                match.matchState.currentBowler ? Player.findById(match.matchState.currentBowler) : null
            ]);
            const currentOverBalls = await Ball.find({
                match: match._id,
                innings: match.matchState.innings,
                over: battingTeam.completedOvers
            }).sort({ ball: 1 });
            const dismissedBatsmanName = isRunOut
                ? (resolvedRunOutState?.dismissedBatsmanId === match.matchState.striker
                    ? batsman.name
                    : resolvedRunOutState?.dismissedBatsmanId === match.matchState.nonStriker
                        ? nonStriker?.name || ""
                        : "")
                : batsman.name;
            const commentaryText = buildCommentary({
                runsOffBat,
                extraType,
                extraRuns,
                isWicket,
                dismissalType: normalizedDismissalType,
                noBallReason,
                dismissedBatsmanName,
                dismissedBatsmanPosition: normalizedDismissedBatsmanPosition
            });

            return res.status(201).json({
                success: true,
                message,
                ball: {
                    ...ballRecord.toObject(),
                    commentaryText,
                    batsmanName: batsman.name,
                    bowlerName: bowler.name,
                    dismissedBatsmanName
                },
                matchSnapshot: {
                    status: match.status,
                    target: match.target,
                    winner: match.winner,
                    winningMargin: match.winningMargin,
                    matchState: {
                        innings: match.matchState.innings,
                        battingTeam: match.matchState.battingTeam,
                        bowlingTeam: match.matchState.bowlingTeam,
                        awaitingNextBatsman: match.matchState.awaitingNextBatsman,
                        isFreeHit: match.matchState.isFreeHit
                    },
                    battingTeam: {
                        score: battingTeam.score,
                        wickets: battingTeam.wickets,
                        completedOvers: battingTeam.completedOvers,
                        ballsInCurrentOver: battingTeam.ballsInCurrentOver,
                        extras: battingTeam.extras
                    }
                },
                scoreboard: {
                    striker: currentStriker
                        ? { _id: String(currentStriker._id), name: currentStriker.name }
                        : null,
                    nonStriker: currentNonStriker
                        ? { _id: String(currentNonStriker._id), name: currentNonStriker.name }
                        : null,
                    bowler: currentBowler
                        ? { _id: String(currentBowler._id), name: currentBowler.name }
                        : null
                },
                currentOver: {
                    over: battingTeam.completedOvers,
                    balls: currentOverBalls
                },
                commentary: [
                    {
                        innings: ballRecord.innings,
                        over: `${ballRecord.over}.${ballRecord.ball}`,
                        commentary: commentaryText
                    }
                ]
            });
        };
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

            return sendScoreResponse("Match completed");
        }

        const totalRunsThisBall = runsOffBat + extraRuns;
        const shouldSwapEnds = !isRunOut && totalRunsThisBall % 2 !== 0;

        if (shouldSwapEnds) {
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

            switch (normalizedDismissalType) {

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

            return sendScoreResponse("Innings ended successfully");
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

                return sendScoreResponse("Innings ended successfully");
            }
        }

        

        
        if (battingTeam.completedOvers >= match.rules.maxOvers) {
            await endMatch(match);
        }
        match.matchState.isFreeHit = nextFreeHit;

        
        
        await match.save();
        return sendScoreResponse("Ball recorded successfully");

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
