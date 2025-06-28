import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { deleteOnCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js";
import { escapeRegExp, removeFileFromLocalMachine } from "../utils/helper.js";

// get all videos based on query, sort, pagination
const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy="createdAt", sortType="desc", userId } = req.query;
    // create matchObject to match criteria
    // add conditions for query and userId for matching
    // add sorting condtions
    // add pagination

    page = parseInt(page) || 1;
    limit = parseInt(limit) || 10;
    const matchObject = {
        $and: [
            { isPublished: true }
        ]
    };

    // filter based on userId
    if(userId) {
        if(!isValidObjectId(userId)) {
            throw new ApiError(400, "Invalid user id");
        }
        matchObject.$and.push({ owner: new mongoose.Types.ObjectId(userId) });
    }

    // search query
    if(query) {
        matchObject.$and.push({
            $or: [
                { title: new RegExp(escapeRegExp(query), 'i') },
                { description: new RegExp(escapeRegExp(query), 'i') },
            ]
        })
    }

    const aggregatePipeline = [
        {
            $match: matchObject
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
                            fullName: 1,
                            avatar: 1,
                            username: 1,
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
    ];

    const videos = await Video.aggregate(aggregatePipeline);

    return res
    .status(200)
    .json(
        new ApiResponse(200, videos, "Videos fetched successfully")
    )
});

// publish a video
const publishAVideo = asyncHandler(async (req, res) => {
  // get data from body
  // validation - not empty
  // check for video and thumbnail
  // upload to the cloudinary
  // create video entry in db
  // return response
  
    const { title, description } = req.body;
    
    let videoFileLocalPath;
    if(req.files && Array.isArray(req.files.videoFile) && req.files.videoFile.length > 0) {
        videoFileLocalPath = req.files.videoFile[0].path;
    }
    
    let thumbnailLocalPath;
    if(req.files && Array.isArray(req.files.thumbnail) && req.files.thumbnail.length > 0) {
        thumbnailLocalPath = req.files.thumbnail[0].path;
    }
    
    if(!videoFileLocalPath || !thumbnailLocalPath) {
        // if any one file not provided then remove other locally stored file
        if(videoFileLocalPath) removeFileFromLocalMachine(videoFileLocalPath);
        if(thumbnailLocalPath) removeFileFromLocalMachine(thumbnailLocalPath);
        throw new ApiError(400, "Video and thumbnail both are required.");
    }
    
    if([title, description].some((field) => field?.trim() === "" || field?.trim() === undefined)) {
        // remove locally stored file
        removeFileFromLocalMachine(videoFileLocalPath);
        removeFileFromLocalMachine(thumbnailLocalPath);
        throw new ApiError(400, "Title and description are required.");
    }

    const videoFile = await uploadOnCloudinary(videoFileLocalPath);
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

    if(!videoFile.url || !thumbnail.url) {
        throw new ApiError(400, "Video and thumbnail both are required.");
    }

    const video = await Video.create({
        videoFile: videoFile.url,
        thumbnail: thumbnail.url,
        title,
        description,
        duration: videoFile.duration,
        owner: req.user._id
    });

    if(!video) {
        throw new ApiError(500, "Something went wrong while publishing video");
    }

    return res
    .status(201)
    .json(
        new ApiResponse(200, video, "Video Published Successfully")
    );
});

// get video by id
const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    if(!videoId || !isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video id");
    }

    const video = await Video.aggregate([
        {
            _id: new mongoose.Types.ObjectId(videoId)
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
                            fullName: 1,
                            username: 1,
                            avatar: 1
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

    if(!video?.length) {
        throw new ApiError(404, "Video not found");
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, video[0], "Video fetched successfully")
    );
});

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    //TODO: update video details like title, description, thumbnail
    // get data and thumbnail from request
    // check video exist
    // upload thumbnail to cloudinary
    // update video details
    // send res

    const { title, description } = req.body;
    const thumbnailLocalPath = req?.file?.path;

    if(!videoId || !isValidObjectId(videoId)) {
        if(thumbnailLocalPath) removeFileFromLocalMachine(thumbnailLocalPath);
        throw new ApiError(400, "Invalid video id");
    }

    const video = await Video.findById(videoId);
    if(!video) {
        if(thumbnailLocalPath) removeFileFromLocalMachine(thumbnailLocalPath);
        throw new ApiError(404, "Video does not exist");
    }

    if(req.user._id !== video.owner) {
        if(thumbnailLocalPath) removeFileFromLocalMachine(thumbnailLocalPath);
        throw new ApiError(400, "You are not the owner of this video");
    }

    if(title) video.title = title;
    if(description) video.description = description;

    if(thumbnailLocalPath) {
        const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);
        if(!thumbnail?.url) {
            throw new ApiError(500, "Error while uploading thumbnail.");
        }
        await deleteOnCloudinary(video.thumbnail, "image");
        video.thumbnail = thumbnail.url;
    }

    await video.save({ validateBeforeSave: false });

    return res
    .status(200)
    .json(
        new ApiResponse(200, { video }, "Video updated successfully")
    );
});

// delete video
const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    if(!videoId || !isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video id");
    }

    const video = await Video.findById(videoId);
    if(!video) {
        throw new ApiError(404, "Video does not exist");
    }

    if(req.user._id !== video.owner) {
        throw new ApiError(400, "You are not the owner of this video");
    }

    // delete video and thumbnail from cloudinary
    await deleteOnCloudinary(video.thumbnail, "image");
    await deleteOnCloudinary(video.videoFile, "video");

    // delete video
    await Video.findByIdAndDelete(videoId);

    return res
    .status(200)
    .json(
        new ApiResponse(200, {}, "Video deleted successfully")
    );
});

// update publish status of the video
const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    if(!videoId || !isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video id");
    }

    const video = await Video.findById(videoId);
    if(!video) {
        throw new ApiError(404, "Video does not exist");
    }

    if(req.user._id !== video.owner) {
        throw new ApiError(400, "You are not the owner of this video");
    }

    await Video.findByIdAndUpdate(videoId, { 
        $set: {
            isPublished: !video.isPublished
        }
    }, { new: true });

    return res
    .status(200)
    .json(
        new ApiResponse(200, {}, "Publish status updated successfully")
    );
});

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
};
