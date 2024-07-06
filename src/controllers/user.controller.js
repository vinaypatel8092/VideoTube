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

export {registerUser};