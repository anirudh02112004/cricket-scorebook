const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");

router.get("/me", authMiddleware, (req, res) => {
    return res.status(200).json({
        success: true,
        user: req.user,
        player: req.player
    });
});

module.exports = router;
