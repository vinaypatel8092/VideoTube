import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";

export const verifyJWT = asyncHandler(async (req, _, next) => {
    try {
        // take token from cookies or headers(in case its a mobile app)
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");
    
        if(!token) {
            throw new ApiError(401, "Unauthorized Request");
        }
    
        // now decode the token(verify token)
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    
        // find user based on _id from decodedToken(bcz we added it while generating token)
        const user = await User.findById(decodedToken?._id).select("-password -refreshToken");
    
        if(!user) {
            throw new ApiError(401, "Invalid Access Token");
        }
    
        // add user in req to be used later
        req.user = user;
        next();
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid Access Token");
    }
})