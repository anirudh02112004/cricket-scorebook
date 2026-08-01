const mongoose = require("mongoose");
const matchSchema = new mongoose.Schema(
    {
        matchDate:{
            type:Date,
            default:Date.now
        },
        tossWinner:{
            type:String,
            enum:["A","B"]
        },
        electedTo:{
            type:String,
            enum:["Batting","Bowling"],
            required:true
        },
        teamA:{
            players:[{
                type:mongoose.Schema.Types.ObjectId,
                ref:"Player"
            }],
            captain: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Player"
            },
            score:{
                type:Number,
                default:0
            },
            wickets:{
                type:Number,
                default:0
            },
            completedOvers: {
                type: Number,
                default: 0
            },

            ballsInCurrentOver: {
                type: Number,
                default: 0
            },
            teamName:{
                type:String,
                default:"Team A"
            },
            extras:{
                wides:{
                    type:Number,
                    default:0
                },
                noBalls:{
                    type:Number,
                    default:0
                },
                byes:{
                    type:Number,
                    default:0
                },
                legByes:{
                    type:Number,
                    default:0
                }
            }
        },
        teamB:{
            players:[{
                type:mongoose.Schema.Types.ObjectId,
                ref:"Player"
            }],
            captain: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Player"
            },
            score:{
                type:Number,
                default:0
            },
            wickets:{
                type:Number,
                default:0
            },
            completedOvers: {
                type: Number,
                default: 0
            },

            ballsInCurrentOver: {
                type: Number,
                default: 0
            },
            teamName:{
                type:String,
                default:"Team B"
            },
            extras:{
                wides:{
                    type:Number,
                    default:0
                },
                noBalls:{
                    type:Number,
                    default:0
                },
                byes:{
                    type:Number,
                    default:0
                },
                legByes:{
                    type:Number,
                    default:0
                }
            }

        },
        target: {
            type: Number,
            default: null
        },
        winner: {
            type: String,
            enum: ["A", "B", "Tie", null],
            default: null
        },

        winningMargin: {
            type: String,
            default: null
        },

        playerOfMatch: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Player",
            default: null
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },

        careerProcessed: {
            type: Boolean,
            default: false
        },
        
        
        status:{
            type:String,
            enum:["Scheduled","In Progress","Completed"],
            default:"Scheduled"
        },
        rules: {
            maxOvers: {
                type: Number,
                required: true,
                default: 8
            },
            maxBouncersPerOver: {
                type: Number,
                required: true,
                default: 1
            },
            freeHitEnabled: {
                type: Boolean,
                default: false
            },
            lbwEnabled: {
                type: Boolean,
                default: false
            },
            heightNoBall: {
                type: Boolean,
                default: true
            },
            overstepNoBall: {
                type: Boolean,
                default: true
            },
            secondBouncerNoBall: {
                type: Boolean,
                default: true
            },
            wideEnabled: {
                type: Boolean,
                default: true
            },
            retirementScore:{
            type:Number,
            default:null
            }
        },
        matchState:{
            innings:{
                type:Number,
                enum:[1,2],
                default:1
            },

            battingTeam:{
                type:String,
                enum:["A","B"]
            },

            bowlingTeam:{
                type:String,
                enum:["A","B"]
            },

            striker:{
                type:mongoose.Schema.Types.ObjectId,
                ref:"Player"
            },

            nonStriker:{
                type:mongoose.Schema.Types.ObjectId,
                ref:"Player"
            },

            currentBowler:{
                type:mongoose.Schema.Types.ObjectId,
                ref:"Player"
            },

            awaitingNextBatsman: {
                type: Boolean,
                default: false
            },

            nextBatsmanIndex:{
                type:Number,
                default:2
            },

            isFreeHit:{
                type:Boolean,
                default:false
            }
        }
            
        
    }
)

const Match = mongoose.model("Match",matchSchema);
module.exports = Match;
