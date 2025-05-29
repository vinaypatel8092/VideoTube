import mongoose, {isValidObjectId} from "mongoose"
import {User} from "../models/user.model.js"
import { Subscription } from "../models/subscription.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"


const toggleSubscription = asyncHandler(async (req, res) => {
    // take channelId from params
    // take subscriber id from req.user
    // check both are valid objectid
    // check if entry exist in db
    // if no - add entry of the subscribe
    // else - remove from db - unsubscribe
    const {channelId} = req.params;

    if(!channelId?.trim()) {
        throw new ApiError(400, "Channel id is missing");
    }
    if(!req?.user?._id) {
        throw new ApiError(400, "Subscriber id is missing");
    }

    if(!isValidObjectId(channelId) || !isValidObjectId(req?.user?._id)) {
        throw new ApiError(400, "Channel id or Subscriber id is not valid");
    }

    // find whether user has already subscribed to the channel
    const existingSubscription = await Subscription.findOne({ channel: channelId, subscriber: req?.user?._id });

    // if already subscribed then unsubscribe to the channel
    if(existingSubscription) {
        await Subscription.deleteOne({ _id: existingSubscription._id });
        return res
        .status(200)
        .json(
            new ApiResponse(200, {}, "Unsubscribed to channel successfully")
        );
    }

    // else subscribe to channel
    const subscription = await Subscription.create({
        channel: channelId,
        subscriber: req?.user?._id
    });

    if(!subscription) {
        throw new ApiError(500, "Something went wrong while subscribing to channel");
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, subscription, "Subscribed to channel successfully")
    );
});

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    // get channelId from params and validate
    // check channel exist
    // get the data from db matching channelId
    const {channelId} = req.params;

    if(!channelId?.trim()) {
        throw new ApiError(400, "Channel id is missing");
    }

    if(!isValidObjectId(channelId)) {
        throw new ApiError(400, "Channel id is not valid");
    }

    const channel = await User.findOne({
        _id: channelId
    });

    if(!channel) {
        throw new ApiError(404, "Channel does not exist");
    }

    const channelSubscribers = await Subscription.aggregate([
        {
            $match: {
                channel: new mongoose.Types.ObjectId(channelId)
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "subscriber",
                foreignField: "_id",
                as: "subscriber",
                pipeline: [
                    {
                        $project: {
                            fullName: 1,
                            avatar: 1,
                            username: 1,
                        }
                    },
                ]
            }
        },
        {
            $addFields: {
                subscriber: {
                    $first: "$subscriber"
                }
            }
        },
        {
            $project: {
                subscriber: 1,
            }
        },
        // { $replaceRoot: { newRoot: "$subscriber" } },    // to get only array of subscriber
    ]);

    return res
    .status(200)
    .json(
        new ApiResponse(200, channelSubscribers, "Channel Subscribers retrieved successfully")
    );
});

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
    // get subscriber id from params
    // check validation
    // find subscribed channels by matching subscriber field
    const { subscriberId } = req.params;
    if(!subscriberId?.trim()) {
        throw new ApiError(400, "Subscriber id is missing");
    }

    if(!isValidObjectId(subscriberId)) {
        throw new ApiError(400, "Subscriber id is not valid");
    }

    const subscribedChannels = await Subscription.aggregate([
        {
            $match: {
                subscriber: new mongoose.Types.ObjectId(subscriberId)
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "channel",
                foreignField: "_id",
                as: "channel",
                pipeline: [
                    {
                        $project: {
                            fullName: 1,
                            avatar: 1,
                            username: 1,
                        }
                    },
                ]
            }
        },
        {
            $addFields: {
                channel: {
                    $first: "$channel"
                }
            }
        },
        {
            $project: {
                channel: 1,
            }
        },
        // { $replaceRoot: { newRoot: "$channel" } },    // to get only array of channels
    ]);

    return res
    .status(200)
    .json(
        new ApiResponse(200, subscribedChannels, "Subscribed Channels retrieved successfully")
    );
});

export {
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels
}