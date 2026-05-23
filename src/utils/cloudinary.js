import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (localFilePath) => {
    if (!localFilePath) return null;

    try {
        const result = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto",
            folder: "trello-clone/attachments",
        });

        fs.unlinkSync(localFilePath);
        return result; // includes: secure_url, public_id, resource_type, bytes, etc.
    } catch (error) {
        if (localFilePath && fs.existsSync(localFilePath))
            fs.unlinkSync(localFilePath);
        return null;
    }
};

const deleteOnCloudinary = async ({ publicId, resourceType = "image" }) => {
    if (!publicId) return null;
    try {
        return await cloudinary.uploader.destroy(publicId, {
            resource_type: resourceType,
        });
    } catch (e) {
        return null;
    }
};

export { uploadOnCloudinary, deleteOnCloudinary };
