import mongoose, {isValidObjectId, mongo} from "mongoose"
import {Like} from "../models/like.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

// toggle like on video
const toggleVideoLike = asyncHandler(async (req, res) => {
    const {videoId} = req.params;
    if(!videoId || !isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video id");
    }

    if(!req.user._id || !isValidObjectId(req.user._id)) {
        throw new ApiError(401, "Unauthorized request");
    }

    const foundLikedVideo = await Like.findOne({
        video: videoId,
        likedBy: req.user._id
    });

    if(foundLikedVideo) {
        try {
            await Like.findByIdAndDelete(foundLikedVideo._id);
        } catch (error) {
            console.log("Error in unlike video: ", error?.message);
            throw new ApiError(500, "Error in unlike video");
        }

        return res
        .status(200)
        .json(
            new ApiResponse(200, {}, "Video unliked successfully")
        );
    } else {
        const likedVideo = await Like.create({
            video: videoId,
            likedBy: req.user._id
        });

        if(!likedVideo) {
            throw new ApiError(500, "Error liking video");
        }

        return res
        .status(201)
        .json(
            new ApiResponse(200, likedVideo, "Video liked successfully")
        );
    }
});

// toggle like on comment
const toggleCommentLike = asyncHandler(async (req, res) => {
    const {commentId} = req.params
    if(!commentId || !isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid video id");
    }

    if(!req.user._id || !isValidObjectId(req.user._id)) {
        throw new ApiError(401, "Unauthorized request");
    }

    const foundLikedComment = await Like.findOne({
        comment: commentId,
        likedBy: req.user._id
    });

    if(foundLikedComment) {
        try {
            await Like.findByIdAndDelete(foundLikedComment._id);
        } catch (error) {
            console.log("Error in unlike comment: ", error?.message);
            throw new ApiError(500, "Error in unlike comment");
        }

        return res
        .status(200)
        .json(
            new ApiResponse(200, {}, "Comment unliked successfully")
        );
    } else {
        const likedComment = await Like.create({
            comment: commentId,
            likedBy: req.user._id
        });

        if(!likedComment) {
            throw new ApiError(500, "Error liking comment");
        }
    
        return res
        .status(201)
        .json(
            new ApiResponse(200, likedComment, "Comment liked successfully")
        );
    }
});

// toggle like on tweet
const toggleTweetLike = asyncHandler(async (req, res) => {
    const {tweetId} = req.params
    if(!tweetId || !isValidObjectId(tweetId)) {
        throw new ApiError(400, "Invalid video id");
    }

    if(!req.user._id || !isValidObjectId(req.user._id)) {
        throw new ApiError(401, "Unauthorized request");
    }
    
    const foundLikedTweet = await Like.findOne({
        tweet: tweetId,
        likedBy: req.user._id
    });
    
    if(foundLikedTweet) {
        try {
            await Like.findByIdAndDelete(foundLikedTweet._id);
        } catch (error) {
            console.log("Error in unlike tweet: ", error?.message);
            throw new ApiError(500, "Error in unlike tweet");
        }

        return res
        .status(200)
        .json(
            new ApiResponse(200, {}, "Tweet unliked successfully")
        );
    } else {
        const likedTweet = await Like.create({
            tweet: tweetId,
            likedBy: req.user._id
        });

        if(!likedTweet) {
            throw new ApiError(500, "Error liking tweet");
        }
    
        return res
        .status(201)
        .json(
            new ApiResponse(200, likedTweet, "Tweet liked successfully")
        );
    }
});

// get all liked videos (published only - there may be chances that liked video may unpublished later)
const getLikedVideos = asyncHandler(async (req, res) => {
    if(!req.user._id || !isValidObjectId(req.user._id)) {
        throw new ApiError(401, "Unauthorized request");
    }

    const likedVideos = await Like.aggregate([
        { 
            $match: { 
                likedBy: new mongoose.Types.ObjectId(req.user._id),
                video: { $exists: true } 
            } 
        },
        // lookup videos (only published)
        {
            $lookup: {
            from: "videos",
            localField: "video",
            foreignField: "_id",
            as: "video",
            pipeline: [
                { $match: { isPublished: true } },
                {
                    $lookup: {
                        from: "users",
                        localField: "owner",
                        foreignField: "_id",
                        as: "owner",
                        pipeline: [{ $project: { name: 1, avatar: 1 } }],
                    },
                },
                { $unwind: "$owner" },
            ],
            },
        },
        // unwind video arrays, drop empty arrays automatically
        {
            $unwind: {
                path: "$video",
                preserveNullAndEmptyArrays: false,
            },
        },
        // replace video as a root document(only select video from like document)
        {
            $replaceRoot: {
                newRoot: "$video",
            },
        }
    ]);

    if(!likedVideos.length) {
        throw new ApiError(404, "No videos found");
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, likedVideos, "Liked videos fetched successfully")
    );
});

export {
    toggleCommentLike,
    toggleTweetLike,
    toggleVideoLike,
    getLikedVideos
}