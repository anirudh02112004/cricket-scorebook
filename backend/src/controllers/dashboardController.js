const Match = require("../models/Match");
const Player = require("../models/Player");

async function getDashboard(req, res) {
    try {
        const activePlayerFilter = {
            isActive: true
        };

        const liveMatch = await Match.findOne({
            status: "In Progress"
        });

        const totalPlayers = await Player.countDocuments(activePlayerFilter);

        const totalMatches = await Match.countDocuments();

        const completedMatches = await Match.countDocuments({
            status: "Completed"
        });

        const liveMatches = await Match.countDocuments({
            status: "In Progress"
        });

        const recentMatches = await Match.find({
            status: "Completed"
        })
        .sort({ matchDate: -1 })
        .limit(5);

        const topRunScorer = await Player
            .findOne(activePlayerFilter)
            .sort({
                "career.batting.runs": -1
            })
            .select("name career.batting.runs");

        const topWicketTaker = await Player
            .findOne(activePlayerFilter)
            .sort({
                "career.bowling.wickets": -1
            })
            .select("name career.bowling.wickets");

        let live = null;

        if (liveMatch) {

            let battingTeam =
                liveMatch.matchState.battingTeam === "A"
                    ? liveMatch.teamA
                    : liveMatch.teamB;

            live = {

                matchId: liveMatch._id,

                teamA: liveMatch.teamA.teamName,

                teamB: liveMatch.teamB.teamName,

                score:
                    `${battingTeam.score}/${battingTeam.wickets}`,

                overs:
                    `${battingTeam.completedOvers}.${battingTeam.ballsInCurrentOver}`

            };

        }

        return res.status(200).json({

            success: true,

            dashboard: {

                liveMatch: live,

                stats: {

                    totalPlayers,

                    totalMatches,

                    completedMatches,

                    liveMatches

                },

                recentMatches,

                topRunScorer,

                topWicketTaker

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

module.exports = {
    getDashboard
};
