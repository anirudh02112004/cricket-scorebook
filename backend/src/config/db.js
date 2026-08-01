const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();
const connectDB = async () =>{
    try{
        await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 10000
        });
        console.log("Mongo DB connected");
    }catch(error){
        console.error(error);
        console.log("MongoDB Connection Failed");
        process.exit(1);
    }

}
module.exports = connectDB;