const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

const connectDB = async () => {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
        throw new Error("MONGODB_URI is not set");
    }

    try {
        console.log("[db] Connecting to MongoDB");
        await mongoose.connect(mongoUri, {
            serverSelectionTimeoutMS: 10000
        });
        console.log(
            `[db] Mongo DB connected: ${mongoose.connection.host}/${mongoose.connection.name}`
        );
    } catch (error) {
        console.error("[db] MongoDB Connection Failed");
        console.error(error);
        process.exit(1);
    }

};
module.exports = connectDB;
