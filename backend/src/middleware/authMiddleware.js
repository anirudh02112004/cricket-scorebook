const User = require("../models/User");
const Player = require("../models/Player");
const mongoose = require("mongoose");
const { initializeFirebaseAdmin } = require("../config/firebaseAdmin");

function normalizePhoto(decodedToken) {
    return decodedToken.picture || decodedToken.photoURL || null;
}

function normalizeName(decodedToken) {
    return (
        decodedToken.name ||
        decodedToken.email?.split("@")[0] ||
        "Cricketer"
    );
}

async function provisionUserFromToken(decodedToken) {
    const firebaseUid = decodedToken.uid;
    const email = String(decodedToken.email || `${firebaseUid}@firebase.local`).toLowerCase();
    const name = normalizeName(decodedToken);
    const photoURL = normalizePhoto(decodedToken);

    let user = await User.findOne({ firebaseUid }).populate("player");

    if (user?.player) {
        const player = await Player.findById(user.player._id);

        if (player) {
            player.name = player.name || name;
            player.email = player.email || email;
            player.firebaseUid = player.firebaseUid || firebaseUid;
            if (!player.profileImage && photoURL) {
                player.profileImage = photoURL;
            }
            if (!player.user) {
                player.user = user._id;
            }
            await player.save();
            user.name = user.name || name;
            user.email = user.email || email;
            user.photoURL = user.photoURL || photoURL;
            user.player = player._id;
            await user.save();
            user.player = player;
            return { user, player };
        }
    }

    let player =
        (await Player.findOne({ firebaseUid })) ||
        (await Player.findOne({ email }));

    if (!player) {
        const userId = new mongoose.Types.ObjectId();
        const playerId = new mongoose.Types.ObjectId();

        player = await Player.create({
            _id: playerId,
            user: userId,
            name,
            role: "All-Rounder",
            battingStyle: "Right Hand",
            bowlingStyle: "Right Arm",
            profileImage: photoURL,
            email,
            firebaseUid
        });

        user = await User.create({
            _id: userId,
            firebaseUid,
            name,
            email,
            photoURL,
            player: playerId,
            role: "player"
        });

        player.user = user._id;
        await player.save();

        return { user, player };
    } else {
        player.name = player.name || name;
        player.email = player.email || email;
        player.firebaseUid = player.firebaseUid || firebaseUid;
        player.role = player.role || "All-Rounder";
        player.battingStyle = player.battingStyle || "Right Hand";
        player.bowlingStyle = player.bowlingStyle || "Right Arm";
        if (!player.profileImage && photoURL) {
            player.profileImage = photoURL;
        }
        await player.save();
    }

    user = await User.findOneAndUpdate(
        { firebaseUid },
        {
            $set: {
                firebaseUid,
                name,
                email,
                photoURL,
                player: player._id,
                role: "player"
            }
        },
        {
            new: true,
            upsert: true,
            runValidators: true
        }
    ).populate("player");

    player.user = user._id;
    player.email = email;
    player.firebaseUid = firebaseUid;
    if (!player.profileImage && photoURL) {
        player.profileImage = photoURL;
    }
    await player.save();

    return { user, player };
}

async function authMiddleware(req, res, next) {
    try {
        const firebaseAuth = initializeFirebaseAdmin();

        console.log("========== BACKEND ==========");
        console.log(req.method);
        console.log(req.originalUrl);
        console.log(req.headers.authorization);

        const authorization = req.headers.authorization || "";
        const [scheme, token] = authorization.split(" ");
        console.log("Scheme:", scheme);
        console.log("Token exists:", !!token);
        console.log("Token length:", token ? token.length : "NULL");

        if (scheme !== "Bearer" || !token) {
            console.warn(`[auth] missing bearer token for ${req.method} ${req.originalUrl}`);
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });
        }

        const tokenParts = token.split(".");
        console.log(`[auth] token parts=${tokenParts.length}, looksLikeJWT=${tokenParts.length === 3}`);
        console.log("Verifying Firebase Token...");
        const decodedToken = await firebaseAuth.verifyIdToken(token);
        console.log("Firebase verification successful");
        console.log(decodedToken);
        const provisioned = await provisionUserFromToken(decodedToken);

        req.auth = {
            firebaseUid: decodedToken.uid,
            email: decodedToken.email || null,
            name: normalizeName(decodedToken),
            photoURL: normalizePhoto(decodedToken)
        };
        req.user = provisioned.user;
        req.player = provisioned.player;

        return next();
    } catch (error) {
        console.error("========== AUTH ERROR ==========");
        console.error(error);
        console.error(error.stack);
        return res.status(401).json({
            success: false,
            message: error?.message || "Unauthorized",
            error: error?.stack || error?.message || String(error)
        });
    }
}

module.exports = authMiddleware;
