import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import fs from "fs";

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
    // console.log("\nreq files: ", req.files);
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
        [fullName, email, username, password].some((field) => field?.trim() === ("" || undefined))
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
            $set: {
                refreshToken: undefined
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

export {
    registerUser,
    loginUser,
    logoutUser
};