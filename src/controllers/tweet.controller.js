import mongoose, { isValidObjectId } from "mongoose"
import {Tweet} from "../models/tweet.model.js"
import {User} from "../models/user.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const createTweet = asyncHandler(async (req, res) => {
    const { content, owner } = req.body;

    // check any field is empty
    if(
        [content, owner].some((field) => field?.trim() === "" || field?.trim() === undefined)
    ) {
        throw new ApiError(400, "All fields are required");
    }

    if(!isValidObjectId(owner)) {
        throw new ApiError(400, "User id is not valid");
    }

    // find whether user doing tweet exist
    const user = await User.findById(owner);
    if(!user) {
        throw new ApiError(400, "User creating tweet does not exist");
    }

    // create new tweet
    const tweet = await Tweet.create({
        content,
        owner
    });

    if(!tweet) {
        throw new ApiError(500, "Something went wrong while adding tweet");
    }

    return res
    .status(201)
    .json(
        new ApiResponse(200, tweet, "Tweet created successfully")
    );
});

const getUserTweets = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    if(!isValidObjectId(userId)) {
        throw new ApiError(400, "User id is not valid");
    }

    // approach-1: get all tweets based on userId
    // const tweets = await Tweet.find({
    //     owner: userId
    // })
    // .populate("owner", "fullName username avatar");

    // approach-2: using aggregation
    const tweets = await Tweet.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            fullName: 1,
                            avatar: 1,
                        }
                    }
                ]
            }
        },
        {
            $addFields: {
                owner: {
                    $first: "$owner"
                }
            }
        }
    ]);

    return res
    .status(200)
    .json(
        new ApiResponse(200, tweets, "Tweets fetched successfully")
    );
});

const updateTweet = asyncHandler(async (req, res) => {
    const { tweetId } = req.params;
    
    if(!isValidObjectId(tweetId)) {
        throw new ApiError(400, "Tweet id is not valid");
    }

    const { content } = req.body;
    if(!content?.trim()) {
        throw new ApiError(400, "Content is required");
    }

    // update tweet content
    const tweet = await Tweet.findByIdAndUpdate(
        { _id: tweetId },
        {
            content
        },
        { new: true }
    );

    if(!tweet) {
        throw new ApiError(500, "Something went wrong while updating tweet or tweet not found")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, tweet, "Tweet updated successfully")
    );
});

const deleteTweet = asyncHandler(async (req, res) => {
    const { tweetId } = req.params;
    
    if(!isValidObjectId(tweetId)) {
        throw new ApiError(400, "Tweet id is not valid");
    }

    await Tweet.findByIdAndDelete({ _id: tweetId });

    return res
    .status(200)
    .json(
        new ApiResponse(200, {}, "Tweet deleted successfully")
    );
});

export {
    createTweet,
    getUserTweets,
    updateTweet,
    deleteTweet
}