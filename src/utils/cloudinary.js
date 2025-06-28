import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

// Configuration
cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if(!localFilePath) return null;
        // upload the file on cloudinary
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto"
        });
        // file has been uploaded successfully
        // console.log("File uploaded on cloudinary: ", response.url);
        fs.unlinkSync(localFilePath);
        // console.log("cloudinary response: ", response);
        return response;
    } catch (error) {
        fs.unlinkSync(localFilePath);   // removes the locally saved temporary file as upload operatin got failed
        return null;
    }
}

const deleteOnCloudinary = async (filePath, resourceType) => {
    try {
        if(!filePath) return null;
        const publicId = filePath.split("/").pop().split(".")[0];
        const response = await cloudinary.uploader.destroy(publicId, {
            resource_type: resourceType
        });
        return response;
    } catch (error) {
        console.log("Error deleting file on cloudinary");
        return null;
    }
}

export { uploadOnCloudinary, deleteOnCloudinary };