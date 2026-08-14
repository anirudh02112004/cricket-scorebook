const Player = require('../models/Player');
async function createPlayer(req,res){
    try{
        const {
            name,
            role,
            battingStyle,
            bowlingStyle,
            jerseyNumber,
            profileImage,
            email,
            firebaseUid
        }=req.body;
        if(!name || !role){
            return res.status(400).json({
                success:false,
                error:"Player name or Role is required"
            });
        }
        const player = await Player.create({
            name,
            role,
            battingStyle,
            bowlingStyle,
            jerseyNumber,
            profileImage,
            email: email || `${String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}@legacy.local`,
            firebaseUid: firebaseUid || `legacy-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
        });
        res.status(201).json({
            success:true,
            player
        });
    } catch (error) {
        res.status(500).json({
            success:false,
            error:error.message
        });
    }
}


async function getPlayerByID(req,res){
    try{
        const player = await Player.findById(req.params.playerId);
        if(!player){
            return res.status(404).json({
                success:false,
                error:"Player not found"
            });
        }
        res.status(200).json({
            success:true,
            player
        });
    } catch (error) {
        res.status(500).json({
            success:false,
            error:error.message
        });
    }
}

async function getAllPlayers(req,res){
    try{
        console.log("[players:list] ROUTE HANDLER START");
        console.log("[players:list] MONGODB QUERY START", {
            isActive: true
        });
        const players = await Player.find({
            isActive:true
        });
        console.log("[players:list] MONGODB QUERY COMPLETE", {
            count: players.length
        });
        console.log("[players:list] RESPONSE SENT", {
            status: 200
        });
        res.status(200).json({
            success:true,
            count:players.length,
            players
        });
    }catch(error){
        console.error("[players:list] FAILED", {
            message: error.message
        });
        res.status(500).json({
            success:false,
            error:error.message
        });
    }
}



async function updatePlayer(req,res){
    try{
        const player = await Player.findById(req.params.playerId);
        if(!player){
            return res.status(404).json({
                success:false,
                error:"Player not found"
            });
        }

        if (String(player._id) !== String(req.user?.player?._id)) {
            return res.status(403).json({
                success:false,
                error:"You can only update your own profile"
            });
        }

        const allowedFields = [
            "role",
            "battingStyle",
            "bowlingStyle",
            "jerseyNumber",
            "profileImage"
        ];

        for (const field of allowedFields) {
            if (Object.prototype.hasOwnProperty.call(req.body || {}, field)) {
                player[field] = req.body[field];
            }
        }

        await player.save();
        res.status(200).json({
            success:true,
            player
        });
    } catch (error) {
        res.status(500).json({
            success:false,
            error:error.message
        });
    }
}




async function deletePlayer(req,res){
    try{
        const player = await Player.findById(req.params.playerId);
        if(!player){
            return res.status(404).json({
                success:false,
                error:"Player not found"
            });
        }
        if (player.user && String(player.user) === String(req.user?.player?._id)) {
            return res.status(400).json({
                success:false,
                error:"Linked player profiles cannot be deleted"
            });
        }

        player.isActive = false;
        await player.save();
        res.status(200).json({
            success:true,
            message:"Player deleted successfully"
        });
    }catch(error){
        res.status(500).json({
            success:false,
            error:error.message
        });
    }
}

async function getPlayerCareer(req, res) {
    try {
        const player = await Player.findById(req.params.playerId);

        if (!player) {
            return res.status(404).json({
                success: false,
                message: "Player not found"
            });
        }

        return res.status(200).json({
            success: true,
            career: {
                name: player.name,
                role: player.role,
                battingStyle: player.battingStyle,
                bowlingStyle: player.bowlingStyle,
                jerseyNumber: player.jerseyNumber,

                batting: player.career.batting,
                bowling: player.career.bowling,
                fielding: player.career.fielding
            }
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

async function getLeaderboard(req, res) {
    try {

        const players = await Player.find();

        const leaderboard = {

            mostRuns: [...players]
                .sort((a, b) => b.career.batting.runs - a.career.batting.runs)
                .slice(0, 5)
                .map(player => ({
                    name: player.name,
                    runs: player.career.batting.runs
                })),

            mostWickets: [...players]
                .sort((a, b) => b.career.bowling.wickets - a.career.bowling.wickets)
                .slice(0, 5)
                .map(player => ({
                    name: player.name,
                    wickets: player.career.bowling.wickets
                })),

            highestStrikeRate: [...players]
                .filter(player => player.career.batting.ballsFaced > 0)
                .sort((a, b) =>
                    b.career.batting.strikeRate -
                    a.career.batting.strikeRate
                )
                .slice(0, 5)
                .map(player => ({
                    name: player.name,
                    strikeRate: player.career.batting.strikeRate.toFixed(2)
                })),

            bestEconomy: [...players]
                .filter(player => player.career.bowling.ballsBowled > 0)
                .sort((a, b) =>
                    a.career.bowling.economy -
                    b.career.bowling.economy
                )
                .slice(0, 5)
                .map(player => ({
                    name: player.name,
                    economy: player.career.bowling.economy.toFixed(2)
                })),

            mostFours: [...players]
                .sort((a, b) =>
                    b.career.batting.fours -
                    a.career.batting.fours
                )
                .slice(0, 5)
                .map(player => ({
                    name: player.name,
                    fours: player.career.batting.fours
                })),

            mostSixes: [...players]
                .sort((a, b) =>
                    b.career.batting.sixes -
                    a.career.batting.sixes
                )
                .slice(0, 5)
                .map(player => ({
                    name: player.name,
                    sixes: player.career.batting.sixes
                }))
        };

        return res.status(200).json({
            success: true,
            leaderboard
        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: error.message
        });

    }
}


module.exports = {
    createPlayer,
    getAllPlayers,
    getPlayerByID,
    getPlayerCareer,
    updatePlayer,
    deletePlayer,
    getLeaderboard
};

