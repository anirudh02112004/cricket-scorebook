const mongoose = require("mongoose");
const ballSchema = new mongoose.Schema(
    {
        match:{
            type:mongoose.Schema.Types.ObjectId,
            ref:"Match",
            required:true
        },
        innings:{
            type:Number,
            enum:[1,2],
            required:true
        },
        over:{
            type:Number,
            required:true
        },
        ball:{
            type:Number,
            required:true
        },
        batsman: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Player",
            required: true
        },
        bowler:{
            type: mongoose.Schema.Types.ObjectId,
            ref:"Player",
            required:true
        },
        nonStriker:{
            type:mongoose.Schema.Types.ObjectId,
            ref:"Player",
            required:true
        },
        fielder:{
            type:mongoose.Schema.Types.ObjectId,
            ref:"Player",
            
        },
        runsOffBat:{
            type:Number,
            default:0
        },
        extraType: {
            type: String,
            enum: [
                "None",
                "Wide",
                "NoBall",
                "Bye",
                "LegBye"
                ],
            default: "None"
        },
        extraRuns:{
            type:Number,
            default:0
        },
        isWicket: {
            type: Boolean,
            default: false
        },

        dismissalType: {
            type: String,
            enum: [
                "Bowled",
                "Caught",
                "LBW",
                "Run Out",
                "Obstructing the Field",
                "Stumped",
                "Hit Wicket",
                "Retired"
            ]
        },
        isBouncer: {
            type: Boolean,
            default: false
        },
        noBallReason: {
            type: String,
            enum: [
                "HEIGHT",
                "OVERSTEP",
                "SECOND_BOUNCER"
            ]
        },
        dismissedBatsman: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Player",
            default: null
        },
        dismissedBatsmanPosition: {
            type: String,
            enum: [
                "STRIKER",
                "NON_STRIKER"
            ],
            default: null
        },
        runsCompleted: {
            type: Number,
            default: 0
        },
        battersCrossed: {
            type: Boolean,
            default: false
        },
        deliveryRequestId: {
            type: String,
            default: null,
            index: true
        },
        commentaryText: {
            type: String,
            default: null
        },
        isFreeHit: {
            type: Boolean,
            default: false
        },
        isLegalDelivery: {
            type: Boolean,
            default: true
        },
        totalRuns: {
            type: Number,
            default: 0
        },
        ballTime: {
            type: Date,
            default: Date.now
        },
        creditedToBowler: {
            type: Boolean,
            default: false
        }

    }
)

const Ball = mongoose.model("Ball", ballSchema);

module.exports = Ball;
