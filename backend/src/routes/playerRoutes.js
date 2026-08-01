console.log("Player routes loaded");

const express = require("express");
const router = express.Router();

const {
    createPlayer,
    getAllPlayers,
    getPlayerByID,
    getPlayerCareer,
    updatePlayer,
    deletePlayer,
    getLeaderboard
} = require("../controllers/playerController");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/", createPlayer);

router.get("/", getAllPlayers);

router.get("/leaderboard", getLeaderboard);

router.get("/:playerId/career", getPlayerCareer);

router.get("/:playerId", getPlayerByID);

router.put("/:playerId", authMiddleware, updatePlayer);

router.delete("/:playerId", authMiddleware, deletePlayer);

module.exports = router;
