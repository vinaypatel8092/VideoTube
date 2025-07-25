import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import { User } from "../models/user.model.js";
import { deleteFromCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import fs from "fs";
import mongoose from "mongoose";

const removeFileFromLocalMachine = (avatarLocalPath, coverImageLocalPath) => {
    if(avatarLocalPath){
        fs.unlinkSync(avatarLocalPath);
    }

    if(coverImageLocalPath){
        fs.unlinkSync(coverImageLocalPath);
    }
}

// function to generate access and refresh token
const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefereshToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });
        
        return { accessToken, refreshToken };

    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating Access and Refresh Token");
    }    
}

const registerUser = asyncHandler( async (req, res) => {
    // get user details from frontend
    // validation - not empty
    // check if user already exist: username, email
    // check for images, check for avatar
    // upload them to cloudinary, avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return response

    const {fullName, email, username, password} = req.body;

    // taking path of avatar and coverImage to upload on cloudinary
    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage?.[0].path;     // alternative of below
    
    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path;
    }

    if(!avatarLocalPath) {
        removeFileFromLocalMachine(avatarLocalPath, coverImageLocalPath);
        throw new ApiError(400, "Avatar file is required");
    }

    // validation for each field
    if(
        [fullName, email, username, password].some((field) => field?.trim() === "" || field?.trim() === undefined)
    ){
        // reomves files uploaded by middleware from local
        removeFileFromLocalMachine(avatarLocalPath, coverImageLocalPath);
        throw new ApiError(400, "All fields are required");
    }
    
    // find if user already exist
    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })
      
    if(existedUser){
        // reomves files uploaded by middleware from local
        removeFileFromLocalMachine(avatarLocalPath, coverImageLocalPath);
        throw new ApiError(409, "User with email or username already exists");
    }
    
    // upload file on cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!avatar) {
        removeFileFromLocalMachine(avatarLocalPath, coverImageLocalPath);
        throw new ApiError(400, "Avatar file is required");
    }
    // create a new user
    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    // removing password and refreshToken from new user to send in response
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    if(!createdUser) {
        removeFileFromLocalMachine(avatarLocalPath, coverImageLocalPath);
        throw new ApiError(500, "Something went wrong while registering the user");
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User Registered Successfully")
    );
})

const loginUser = asyncHandler( async (req, res) => {
    // req body -> data
    // username or email based login
    // find the user
    // password check
    // generete access token and refresh token
    // send token

    const {email, username, password} = req.body;

    if(!username && !email) {
        throw new ApiError(400, "Username or Email is required");
    }
    // alternative of above
    // if(!(username || email)) {
    //     throw new ApiError(400, "Username or Email is required");
    // }
    
    // check if user exist
    const user = await User.findOne({
      $or: [{ username }, { email }],
    });

    if(!user) {
        throw new ApiError(404, "User does not exist");
    }

    // password checking
    const isPasswordValid = await user.isPasswordCorrect(password);
    
    if(!isPasswordValid) {
        throw new ApiError(401, "Invalid user credentials");
    }

    // generating access and refresh token
    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    // options for cookie - by this cookies are only modified from server
    const options = {
        httpOnly: true,
        secure: true
    }

    // set accessToken and refreshToken in cookie
    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User logged In Successfully"
        )
    )
})

const logoutUser = asyncHandler(async (req, res) => {
    // access req.user from req
    // find user by _id and remove refreshToken
    // remove accessToken and refreshToken from cookie
    
    // req.user comes from middleware verifyJWT
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1 // this removes the field from document
            }
        },
        {
            new: true
        }
    );

    // options for cookie - by this cookies are only modified from server
    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User Logged Out"));
});

// controller for generating new access and refresh token while user's tokens are expired
const refreshAccessToken = asyncHandler(async (req, res) => {
    // take refreshToken from cookie or body
    // decode incoming token
    // check decoded token with user's refresh token in db
    // generate new access and refresh tokens
    // send in cookie

    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if(!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized Request");
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
    
        const user = await User.findById(decodedToken?._id);
    
        if(!user) {
            throw new ApiError(401, "Invalid Refresh Token");
        }
    
        if(incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh Token is expired or used");
        }
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        const {accessToken, refreshToken: newRefreshToken} = await generateAccessAndRefreshTokens(user?._id);
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(new ApiResponse(
            200,
            { accessToken, refreshToken: newRefreshToken },
            "Access Token Refreshed"
        ))
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid Refresh Token");
    }

});

const changeCurrentPassword = asyncHandler(async(req, res) => {
    const {oldPassword, newPassword} = req.body;
    
    const user = await User.findById(req.user?._id);
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

    if(!isPasswordCorrect) {
        throw new ApiError(400, "Invalid old password");
    }

    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
    return res
    .status(200)
    .json(new ApiResponse(200, req.user, "Current User Fetched Successfully"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullName, email } = req.body;

    if(!fullName || !email) {
        throw new ApiError(400, "All fields are required");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName: fullName,
                email: email
            }
        },
        { new: true }
    ).select("-password");

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path;
    
    if(!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is missing");
    }

    const user = await User.findById(req.user._id);
    if(!user) {
        throw new ApiError(404, "User not found");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);

    if(!avatar.url) {
        removeFileFromLocalMachine(avatarLocalPath, _);
        throw new ApiError(500, "Error while uploading avatar on cloudinary");
    }

    // delete old avatar from cloudinary
    await deleteFromCloudinary(user.avatar, "image");

    const updatedUser = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        { new: true }
    ).select("-password");

    return res
    .status(200)
    .json(new ApiResponse(200, updatedUser, "Avatar Image updated successfully"));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path;
    
    if(!coverImageLocalPath) {
        throw new ApiError(400, "Cover image file is missing");
    }

    const user = await User.findById(req.user._id);
    if(!user) {
        throw new ApiError(404, "User not found");
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!coverImage.url) {
        removeFileFromLocalMachine(_, coverImageLocalPath);
        throw new ApiError(500, "Error while uploading cover image on cloudinary");
    }

    // delete old cover image from cloudinary
    if(user?.coverImage?.trim()) {
        await deleteFromCloudinary(user?.coverImage, "image");
    }

    const updatedUser = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: coverImage.url
            }
        },
        { new: true }
    ).select("-password");

    return res
    .status(200)
    .json(new ApiResponse(200, updatedUser, "Cover Image updated successfully"));
});

// get channel details
const getUserChannelProfile = asyncHandler(async (req, res) => {
    // get username from params(url)
    // apply aggregation
    // find user based on username
    // find subscriber count
    // find subscribed to count
    // find is user subscribed to that channel-take user id from req.user
    const { username } = req.params;

    if(!username) {
        throw new ApiError(400, "Username is missing");
    }

    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
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
            $addFields:{
                subscribersCount: {
                    $size: "$subscribers"
                },
                channelSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: { $in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1
            }
        }
    ]);
    
    if(!channel?.length) {
        throw new ApiError(404, "Channel does not exist");
    }

    return res
    .status(200)
    .json(new ApiResponse(200, channel[0], "User channel fetched successfully"));
});

// get user's watch history
const getWatchHistory = asyncHandler(async (req, res) => {
    // get the user from req.user._id
    // lookup into watchHistory to get videos
    // now again lookup into owner in each document of videos to get owner details
    // lookup into owner gives array so take first value from it
    // also apply project to get only required fields
    // return watchHistory
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
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
                        },
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ]);

    if(!user.length) {
        throw new ApiError(404, "User not found");
    }

    return res
    .status(200)
    .json(new ApiResponse(200, user[0]?.watchHistory, "Watch histroy fetched successfully"));
});

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
};