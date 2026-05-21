import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null;

        const uploadResult = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto",
        });

        // File uploaded successfully - remove from local disk
        fs.unlinkSync(localFilePath);

        return uploadResult;
    } catch (error) {
        console.log("Cloudinary upload ERROR:", error);
        // Remove local file even if upload failed
        if (localFilePath && fs.existsSync(localFilePath)) {
            fs.unlinkSync(localFilePath);
        }
        return null;
    }
};

const getPublicIdFromUrl = (url) => {
    const regex = /\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/;
    const match = url.match(regex);
    return match ? match[1] : null;
};

const deleteOnCloudinary = async (fileUrl) => {
    try {
        if (!fileUrl) return null;

        const publicId = getPublicIdFromUrl(fileUrl);
        if (!publicId) return null;

        const result = await cloudinary.uploader.destroy(publicId);
        return result;
    } catch (error) {
        console.log("Cloudinary delete ERROR:", error);
        return null;
    }
};

export { uploadOnCloudinary, deleteOnCloudinary };
