import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const healthcheck = asyncHandler(async (_, res) => {
    return res.status(200).json(
        new ApiResponse(200, { status: "OK" }, "Server is running.")
    )
});

export { healthcheck };
