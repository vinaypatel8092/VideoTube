import mongoose, { isValidObjectId } from "mongoose"
import {Comment} from "../models/comment.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

// get all comments for a video
const getVideoComments = asyncHandler(async (req, res) => {
    const {videoId} = req.params;
    const {page = 1, limit = 10} = req.query;

    if(!videoId || !isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video id or video id is required");
    }

    const options = {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 10,
    };

    const pipeline = [
        {
            $match: {
                video: new mongoose.Types.ObjectId(videoId)
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
                            name: 1,
                            avatar: 1,
                            username: 1,
                        }
                    }
                ]
            }
        },
        {
            $unwind: "$owner"
        }
    ];

    const aggregate = Comment.aggregate(pipeline);

    const videoComments = await Comment.aggregatePaginate(aggregate, options);

    if(!videoComments) {
        throw new ApiError(500, "Something went wrong while fetching comments");
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, videoComments.docs, "Video comments fetched successfully")
    );
})

// add a comment to a video
const addComment = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const { content } = req.body;

    if(!videoId || !isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video id or video id is required");
    }

    if(!req.user._id || !isValidObjectId(req.user._id)) {
        throw new ApiError(401, "Unauthorized request");
    }

    if(!content || content.trim() === "") {
        throw new ApiError(400, "Content is required");
    }

    const comment = await Comment.create({
        content,
        video: videoId,
        owner: req.user._id
    });

    if(!comment) {
        throw new ApiError(500, "Something went wrong while adding comment");
    }

    return res
    .status(201)
    .json(
        new ApiResponse(200, comment, "Comment added succssfully")
    );
})

// update a comment
const updateComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params;
    if(!commentId || !isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid comment id or missing comment id");
    }
    
    const { content } = req.body;
    if(!content || content.trim() === "") {
        throw new ApiError(400, "Content is required");
    }

    const comment = await Comment.findById(commentId);

    if(!comment) {
        throw new ApiError(404, "Comment not found");
    }

    if(comment.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(400, "You are not allowed to update this comment");
    }

    const updatedComment = await Comment.findByIdAndUpdate(commentId, {
        $set: {
            content
        }
    }, { new: true });

    if(!updatedComment) {
        throw new ApiError(500, "Error while updating comment");
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, updatedComment, "Comment updated successfully")
    );
});

// delete a comment
const deleteComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params;
    if(!commentId || !isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid comment id or missing comment id");
    }

    const comment = await Comment.findById(commentId);

    if(!comment) {
        throw new ApiError(404, "Comment not found");
    }

    if(comment.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(400, "You are not allowed to delete this comment");
    }

    await Comment.findByIdAndDelete(commentId);

    return res
    .status(200)
    .json(
        new ApiResponse(200, {}, "Comment deleted successfully")
    );
});

export {
    getVideoComments, 
    addComment, 
    updateComment,
    deleteComment
}