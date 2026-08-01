const Match = require("../models/Match");
const Player = require("../models/Player");

async function search(req, res) {

    try {

        const query = req.query.query;

        if (!query) {

            return res.status(400).json({

                success: false,

                message: "Search query required"

            });

        }

        const players = await Player.find({

            name: {

                $regex: query,

                $options: "i"

            }

        })
        .select("name role");

        const matches = await Match.find({

            $or: [

                {

                    "teamA.teamName": {

                        $regex: query,

                        $options: "i"

                    }

                },

                {

                    "teamB.teamName": {

                        $regex: query,

                        $options: "i"

                    }

                }

            ]

        });

        return res.status(200).json({

            success: true,

            players,

            matches

        });

    }

    catch (error) {

        return res.status(500).json({

            success: false,

            message: error.message

        });

    }

}

module.exports = {

    search

};


