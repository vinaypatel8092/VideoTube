import mongoose, {isValidObjectId} from "mongoose"
import {Playlist} from "../models/playlist.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import { Video } from "../models/video.model.js"


// create playlist
const createPlaylist = asyncHandler(async (req, res) => {
    const {name, description} = req.body;
    if([name, description].some((field) => field?.trim() === "" || field?.trim() === undefined)) {
        throw new ApiError(400, "Name and Description of playlist are required");
    }

    if(!req.user._id || !isValidObjectId(req.user._id)) {
        throw new ApiError(401, "Unauthorized request");
    }

    const playlist = await Playlist.create({
        name,
        description,
        owner: req.user._id
    });

    if(!playlist) {
        throw new ApiError(500, "Error while creatin playlist");
    }

    return res
    .status(201)
    .json(
        new ApiResponse(200, playlist, "Playlist created successfully")
    );
});

// get user playlists
const getUserPlaylists = asyncHandler(async (req, res) => {
    const {userId} = req.params;

    if(!userId || !isValidObjectId(userId)) {
        throw new ApiError(400, "Invalid user id or user id missing");
    }

    const playlists = await Playlist.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(userId)
            }
        },
        // add number of videos in playlist
        {
            $addFields: {
                videoCounts: {
                    $size: "$videos"
                }
            }
        },
        {
            $sort: {
                createdAt: -1
            }
        },
        {
            $project: {
                name: 1,
                description: 1,
                videoCounts: 1,
            }
        },
    ]);

    if(!playlists.length) {
        throw new ApiError(404, "No playlists found");
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, playlists, "User playlists fetched successfully")
    );
});

// get playlist by id
const getPlaylistById = asyncHandler(async (req, res) => {
    const {playlistId} = req.params;

    if(!playlistId || !isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlist id or playlist id missing");
    }

    const playlist = await Playlist.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(playlistId)
            }
        },
        // lookup videos (only published)
        {
            $lookup: {
                from: "videos",
                localField: "videos",
                foreignField: "_id",
                as: "videos",
                pipeline: [
                    { $match: { isPublished: true } },
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
                    { $unwind: "$owner" },
                    {
                        $project: {
                            thumbnail: 1,
                            title: 1,
                            description: 1,
                            duration: 1,
                            views: 1,
                            owner: 1,
                        }
                    }
                ]
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
                            fullName: 1,
                            avatar: 1,
                            username: 1,
                        }
                    }
                ]
            }
        },
        { $unwind: "$owner" },
    ]);

    if(!playlist) {
        throw new ApiError(404, "Playlist not found");
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, playlist, "Playlist fetched successfully")
    );
});

// add video to playlist
const addVideoToPlaylist = asyncHandler(async (req, res) => {
    const {playlistId, videoId} = req.params;

    if(!playlistId || !isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlist id or playlist id missing");
    }
    
    if(!videoId || !isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video id or video id missing");
    }

    const video = await Video.findById(videoId);
    if(!video) {
        throw new ApiError(400, "Video not found");
    }

    const playlist = await Playlist.findById(playlistId);
    if(!playlist) {
        throw new ApiError(400, "Playlist not found");
    }

    if(playlist.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(400, "You are not add videos to the playlist");
    }

    if(playlist.videos.includes(videoId)) {
        throw new ApiError(400, "Video already exist in playlist");
    }

    const updatedPlaylist = await Playlist.findByIdAndUpdate(
        playlistId,
        {
            $push: {
                videos: videoId
            }
        },
        { new: true }
    );

    if(!updatedPlaylist) {
        throw new ApiError(500, "Something went wrong while adding video to playlist");
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, updatedPlaylist, "Video added to playlist successfully")
    );
});

// remove video from playlist
const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
    const {playlistId, videoId} = req.params

    if(!playlistId || !isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlist id or playlist id missing");
    }
    
    if(!videoId || !isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video id or video id missing");
    }

    const video = await Video.findById(videoId);
    if(!video) {
        throw new ApiError(400, "Video not found");
    }

    const playlist = await Playlist.findById(playlistId);
    if(!playlist) {
        throw new ApiError(400, "Playlist not found");
    }
    
    if(playlist.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(400, "You are not delete videos from the playlist");
    }

    if(!playlist.videos.includes(videoId)) {
        throw new ApiError(400, "Video does not exist in playlist");
    }
    
    const updatedPlaylist = await Playlist.findByIdAndUpdate(
        playlistId,
        {
            $pull: {
                videos: videoId
            }
        },
        { new: true }
    );

    if(!updatedPlaylist) {
        throw new ApiError(500, "Something went wrong while removing video from playlist");
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, updatedPlaylist, "Video removed successfully from playlist")
    );
});

// delete playlist
const deletePlaylist = asyncHandler(async (req, res) => {
    const {playlistId} = req.params;
    if(!playlistId || !isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlist id or playlist id missing");
    }

    const playlist = await Playlist.findById(playlistId);
    if(!playlist) {
        throw new ApiError(400, "Playlist not found");
    }
    
    if(playlist.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(400, "You are not delete the playlist");
    }

    await Playlist.findByIdAndDelete(playlistId);

    return res
    .status(200)
    .json(
        new ApiResponse(200, {}, "Playlist deleted successfully")
    );
});

// update playlist
const updatePlaylist = asyncHandler(async (req, res) => {
    const {playlistId} = req.params;
    const {name, description} = req.body;

    if(!playlistId || !isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlist id or playlist id missing");
    }

    if([name, description].some(field => !field?.trim() === "" || field?.trim() === undefined)) {
        throw new ApiError(400, "Name and description of playlist are required");
    }

    const playlist = await Playlist.findById(playlistId);
    if(!playlist) {
        throw new ApiError(400, "Playlist not found");
    }
    
    if(playlist.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(400, "You are not update the playlist");
    }

    const updatedPlaylist = await Playlist.findByIdAndUpdate(
        playlistId,
        {
            $set: {
                name, description
            }
        },
        { new: true }
    );

    if(!updatedPlaylist) {
        throw new ApiError(500, "Something went wrong while updating playlist");
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, updatedPlaylist, "Playlist updated successfully")
    );
});

export {
    createPlaylist,
    getUserPlaylists,
    getPlaylistById,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    deletePlaylist,
    updatePlaylist
}