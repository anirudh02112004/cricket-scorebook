const express = require("express");
const router = express.Router();

const { scoreBall, undoLastBall } = require("../controllers/ballController");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/", authMiddleware, scoreBall);

router.patch("/:matchId/undo", authMiddleware, undoLastBall);

module.exports = router;

