const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        firebaseUid: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },
        name: {
            type: String,
            required: true,
            trim: true
        },
        email: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true
        },
        photoURL: {
            type: String,
            default: null
        },
        player: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Player",
            required: true,
            unique: true
        },
        role: {
            type: String,
            default: "player",
            trim: true
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("User", userSchema);
