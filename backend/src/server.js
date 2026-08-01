const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const path = require("path");
const connectDB = require("./config/db");

const playerRoutes = require("./routes/playerRoutes");
const matchRoutes = require("./routes/matchRoutes");
const authRoutes = require("./routes/authRoutes");

const dashboardRoutes = require("./routes/dashboardRoutes");

const searchRoutes = require("./routes/searchRoutes");

const scoreRoutes = require("./routes/scoreRoutes");
console.log("✅ Score routes loaded");




dotenv.config();

const app = express();

const allowedOrigins = new Set(
    [
        process.env.FRONTEND_ORIGIN,
        "https://cricket-scorebook.vercel.app",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001"
    ].filter(Boolean)
);

app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin)) {
            return callback(null, true);
        }

        if (/^http:\/\/localhost:\d+$/.test(origin) || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) {
            return callback(null, true);
        }

        return callback(new Error("CORS blocked"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true
}));

app.use(express.json());
app.use("/images", express.static(path.join(__dirname, "..", "images")));

connectDB();

app.use("/api/players", playerRoutes);
app.use("/api/matches", matchRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/score", scoreRoutes);
app.use("/api/search", searchRoutes);



app.use("/api/dashboard", dashboardRoutes);



// Later
// app.use("/api/score", scoreRoutes);

app.get("/", (req, res) => {
    res.json({
        message: "Welcome to Cricket Scorebook API"
    });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
