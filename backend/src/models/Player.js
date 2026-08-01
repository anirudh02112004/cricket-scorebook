const mongoose = require("mongoose");

const playerSchema = new mongoose.Schema(
{
    name: {
        type: String,
        required: true,
        trim: true
    },

    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        unique: true,
        sparse: true,
        required: function requiredUser() {
            return this.isNew && !String(this.firebaseUid || "").startsWith("legacy-");
        }
    },

    email: {
        type: String,
        trim: true,
        lowercase: true,
        unique: true,
        sparse: true,
        required: function requiredEmail() {
            return this.isNew;
        }
    },

    firebaseUid: {
        type: String,
        trim: true,
        unique: true,
        sparse: true,
        required: function requiredFirebaseUid() {
            return this.isNew;
        }
    },

    role: {
        type: String,
        enum: ["Batsman", "Bowler", "All-Rounder", "Wicket-Keeper"],
        required: true
    },

    battingStyle: {
        type: String,
        trim: true
    },

    bowlingStyle: {
        type: String,
        trim: true
    },

    jerseyNumber: {
        type: Number
    },

    isActive: {
        type: Boolean,
        default: true
    },

    profileImage: {
        type: String,
        default: null
    },

    // -----------------------
    // Career Statistics
    // -----------------------

    career: {

        batting: {

            matches: {
                type: Number,
                default: 0
            },

            innings: {
                type: Number,
                default: 0
            },

            runs: {
                type: Number,
                default: 0
            },

            ballsFaced: {
                type: Number,
                default: 0
            },

            highestScore: {
                type: Number,
                default: 0
            },

            fours: {
                type: Number,
                default: 0
            },

            sixes: {
                type: Number,
                default: 0
            },

            notOuts: {
                type: Number,
                default: 0
            },

            average: {
                type: Number,
                default: 0
            },

            strikeRate: {
                type: Number,
                default: 0
            }
        },

        bowling: {

            matches: {
                type: Number,
                default: 0
            },

            innings: {
                type: Number,
                default: 0
            },

            ballsBowled: {
                type: Number,
                default: 0
            },

            runsConceded: {
                type: Number,
                default: 0
            },

            wickets: {
                type: Number,
                default: 0
            },

            economy: {
                type: Number,
                default: 0
            },

            average: {
                type: Number,
                default: 0
            },

            bestFigures: {

                wickets: {
                    type: Number,
                    default: 0
                },

                runs: {
                    type: Number,
                    default: 0
                }
            }
        },

        fielding: {

            catches: {
                type: Number,
                default: 0
            },

            runOuts: {
                type: Number,
                default: 0
            },

            stumpings: {
                type: Number,
                default: 0
            }
        }
    },

    // -----------------------
    // Match Statistics
    // Reset before every match
    // -----------------------

    matchStats: {

        batting: {

            runs: {
                type: Number,
                default: 0
            },

            balls: {
                type: Number,
                default: 0
            },

            fours: {
                type: Number,
                default: 0
            },

            sixes: {
                type: Number,
                default: 0
            },

            isOut: {
                type: Boolean,
                default: false
            }

        },

        bowling: {

            balls: {
                type: Number,
                default: 0
            },

            maidens: {
                type: Number,
                default: 0
            },

            runs: {
                type: Number,
                default: 0
            },

            wickets: {
                type: Number,
                default: 0
            }

        }

    },

    ducks: {
        type: Number,
        default: 0
    },

    fifties: {
        type: Number,
        default: 0
    },

    hundreds: {
        type: Number,
        default: 0
    }
},
{
    timestamps: true
}
);

module.exports = mongoose.model("Player", playerSchema);
