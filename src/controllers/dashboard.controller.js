import mongoose from "mongoose"
import {Video} from "../models/video.model.js"
import {Subscription} from "../models/subscription.model.js"
import {Like} from "../models/like.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import { User } from "../models/user.model.js"
import { escapeRegExp } from "../utils/helper.js"

// Get the channel stats like total video views, total subscribers, total videos, total likes etc.
const getChannelStats = asyncHandler(async (req, res) => {
    const channelStats = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "_id",
                foreignField: "owner",
                as: "videos",
                pipeline: [
                    {
                        $lookup: {
                            from: "likes",
                            localField: "_id",
                            foreignField: "video",
                            as: "videoLikes"
                        }
                    },
                    {
                        $addFields: {
                            videoLikes: {
                                $size: "$videoLikes"
                            }
                        }
                    },
                    {
                        $project: {
                            views: 1,
                            videoLikes: 1,
                        }
                    }
                ]
            }
        },
        {
            $addFields: {
                totalVideos: {
                    $size: "$videos"
                },
                totalViews: {
                    $sum: "$videos.views"
                },
                totalVideoLikes: {
                    $sum: "$videos.videoLikes"
                }
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                totalSubscribers: {
                    $size: "$subscribers"
                },
                totalChannelSubscribedTo: {
                    $size: "$subscribedTo"
                }
            }
        },
        {
            $project: {
                username: 1,
                avatar: 1,
                coverImage: 1,
                fullName: 1,
                totalVideos: 1,
                totalViews: 1,
                totalVideoLikes: 1,
                totalSubscribers: 1,
                totalChannelSubscribedTo: 1,
            }
        }
    ]);

    if(!channelStats.length) {
        throw new ApiError(404, "Channel stats not found");
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, channelStats[0], "Channel Stats retrieved successfully")
    );
});

// Get all the videos uploaded by the channel
const getChannelVideos = asyncHandler(async (req, res) => {
    const { query, sortBy="createdAt", sortType="desc" } = req.query;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const matchObject = {
        $and: [
            { owner: new mongoose.Types.ObjectId(req.user._id) }
        ]
    };

    // search query
    if(query) {
        matchObject.$and.push({
            $or: [
                { title: new RegExp(escapeRegExp(query), 'i') },
                { description: new RegExp(escapeRegExp(query), 'i') },
            ]
        })
    }
    
    const channelVideos = await Video.aggregate([
        {
            $match: matchObject
        },
        // add video likes
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "video",
                as: "likes"
            }
        },
        {
            $addFields: {
                likes: {
                    $size: "$likes"
                }
            }
        },
        // sorting
        {
            $sort: {
                [sortBy]: sortType === "desc" ? -1 : 1
            }
        },
        // pagination
        {
            $skip: (page - 1) * limit
        },
        {
            $limit: limit
        }
    ]);

    if(!channelVideos.length) {
        throw new ApiError(404, "No channel videos found");
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, channelVideos, "Channel videos fetched successfully")
    );
});

export {
    getChannelStats, 
    getChannelVideos
}