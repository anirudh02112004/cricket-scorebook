const User = require("../models/User");
const Player = require("../models/Player");
const mongoose = require("mongoose");
const { initializeFirebaseAdmin } = require("../config/firebaseAdmin");

function logProvision(step, payload) {
    console.log(`[auth][provision] ${step}`, payload);
}

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

function serializeError(error) {
    return {
        name: error?.name || "Error",
        message: error?.message || String(error),
        code: error?.code || null,
        keyValue: error?.keyValue || null,
        stack: error?.stack || null
    };
}

function normalizeRef(value) {
    if (!value) {
        return null;
    }

    if (typeof value === "object") {
        return String(value._id || value.id || "");
    }

    return String(value);
}

async function provisionUserFromToken(decodedToken) {
    const firebaseUid = decodedToken.uid;
    const email = String(decodedToken.email || `${firebaseUid}@firebase.local`).toLowerCase();
    const name = normalizeName(decodedToken);
    const photoURL = normalizePhoto(decodedToken);

    logProvision("Received Firebase UID", {
        firebaseUid,
        email,
        name,
        hasPhotoURL: Boolean(photoURL)
    });

    const session = await mongoose.startSession();

    try {
        let provisionedUser = null;
        let provisionedPlayer = null;

        await session.withTransaction(async () => {
            let user = await User.findOne({ firebaseUid })
                .populate("player")
                .session(session);

            logProvision("Existing User", user ? {
                _id: String(user._id),
                firebaseUid: user.firebaseUid,
                email: user.email,
                player: normalizeRef(user.player)
            } : null);

            let player = null;

            const linkedPlayerId = normalizeRef(user?.player);
            if (linkedPlayerId) {
                player = await Player.findById(linkedPlayerId).session(session);
            }

            if (!player) {
                player =
                    (await Player.findOne({ firebaseUid }).session(session)) ||
                    (await Player.findOne({ email }).session(session));
            }

            logProvision("Existing Player", player ? {
                _id: String(player._id),
                user: normalizeRef(player.user),
                email: player.email,
                firebaseUid: player.firebaseUid
            } : null);

            if (!user && !player) {
                const userId = new mongoose.Types.ObjectId();
                const playerId = new mongoose.Types.ObjectId();

                logProvision("Creating Player", {
                    _id: String(playerId),
                    user: String(userId),
                    email,
                    firebaseUid
                });

                player = new Player({
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

                logProvision("Saving Player", {
                    _id: String(player._id),
                    user: normalizeRef(player.user)
                });
                await player.save({ session });

                logProvision("Creating User", {
                    _id: String(userId),
                    player: String(player._id),
                    email,
                    firebaseUid
                });

                user = new User({
                    _id: userId,
                    firebaseUid,
                    name,
                    email,
                    photoURL,
                    player: player._id,
                    role: "player"
                });

                logProvision("Saving User", {
                    _id: String(user._id),
                    player: normalizeRef(user.player)
                });
                await user.save({ session });

                player.user = user._id;
                logProvision("Saving Player", {
                    _id: String(player._id),
                    user: normalizeRef(player.user)
                });
                await player.save({ session });
            } else if (user && player) {
                user.name = user.name || name;
                user.email = user.email || email;
                user.photoURL = user.photoURL || photoURL;
                user.player = player._id;

                player.name = player.name || name;
                player.email = player.email || email;
                player.firebaseUid = player.firebaseUid || firebaseUid;
                player.role = player.role || "All-Rounder";
                player.battingStyle = player.battingStyle || "Right Hand";
                player.bowlingStyle = player.bowlingStyle || "Right Arm";
                if (!player.profileImage && photoURL) {
                    player.profileImage = photoURL;
                }
                if (!player.user) {
                    player.user = user._id;
                }

                logProvision("Saving User", {
                    _id: String(user._id),
                    player: normalizeRef(user.player)
                });
                await user.save({ session });

                logProvision("Saving Player", {
                    _id: String(player._id),
                    user: normalizeRef(player.user)
                });
                await player.save({ session });
            } else if (user && !player) {
                const playerId = new mongoose.Types.ObjectId();

                logProvision("Creating Player", {
                    _id: String(playerId),
                    user: String(user._id),
                    email,
                    firebaseUid
                });

                player = new Player({
                    _id: playerId,
                    user: user._id,
                    name,
                    role: "All-Rounder",
                    battingStyle: "Right Hand",
                    bowlingStyle: "Right Arm",
                    profileImage: photoURL,
                    email,
                    firebaseUid
                });

                logProvision("Saving Player", {
                    _id: String(player._id),
                    user: normalizeRef(player.user)
                });
                await player.save({ session });

                user.name = user.name || name;
                user.email = user.email || email;
                user.photoURL = user.photoURL || photoURL;
                user.player = player._id;

                logProvision("Saving User", {
                    _id: String(user._id),
                    player: normalizeRef(user.player)
                });
                await user.save({ session });
            } else if (!user && player) {
                const userId = new mongoose.Types.ObjectId();

                logProvision("Creating User", {
                    _id: String(userId),
                    player: String(player._id),
                    email,
                    firebaseUid
                });

                user = new User({
                    _id: userId,
                    firebaseUid,
                    name,
                    email,
                    photoURL,
                    player: player._id,
                    role: "player"
                });

                logProvision("Saving User", {
                    _id: String(user._id),
                    player: normalizeRef(user.player)
                });
                await user.save({ session });

                player.name = player.name || name;
                player.email = player.email || email;
                player.firebaseUid = player.firebaseUid || firebaseUid;
                player.role = player.role || "All-Rounder";
                player.battingStyle = player.battingStyle || "Right Hand";
                player.bowlingStyle = player.bowlingStyle || "Right Arm";
                if (!player.profileImage && photoURL) {
                    player.profileImage = photoURL;
                }
                player.user = user._id;

                logProvision("Saving Player", {
                    _id: String(player._id),
                    user: normalizeRef(player.user)
                });
                await player.save({ session });
            }

            provisionedUser = user;
            provisionedPlayer = player;

            logProvision("Returning User", {
                userId: provisionedUser ? String(provisionedUser._id) : null,
                playerId: provisionedPlayer ? String(provisionedPlayer._id) : null,
                firebaseUid
            });
        });

        return {
            user: provisionedUser,
            player: provisionedPlayer
        };
    } catch (error) {
        console.error("[auth][provision] Failed");
        console.error(serializeError(error));
        throw error;
    } finally {
        session.endSession();
    }
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
        console.log("[auth] Received Firebase UID:", decodedToken.uid);
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
        const status = error?.code === 11000 ? 409 : 500;
        return res.status(status).json({
            success: false,
            message: error?.message || "Unauthorized",
            error: error?.stack || error?.message || String(error),
            code: error?.code || null,
            keyValue: error?.keyValue || null,
            status
        });
    }
}

module.exports = authMiddleware;
