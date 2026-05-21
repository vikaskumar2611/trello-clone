import multer from "multer";
import path from "path";
import { MAX_FILE_SIZE_BYTES, ALLOWED_MIME_TYPES } from "../constants.js";
import { ApiError } from "../utils/ApiError.js";

// Files land in public/temp/ first
// Controller then pushes to Cloudinary and deletes local file
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "public/temp");
    },
    filename: function (req, file, cb) {
        // fieldname + timestamp + original name avoids collisions
        const uniqueFilename = `${file.fieldname}-${Date.now()}-${file.originalname}`;
        cb(null, uniqueFilename);
    },
});

// Filter: only allow file types defined in constants
const fileFilter = (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(
            new ApiError(
                400,
                `File type not allowed. Allowed types: ${ALLOWED_MIME_TYPES.join(", ")}`,
            ),
            false,
        );
    }
};

export const upload = multer({
    storage,
    limits: {
        fileSize: MAX_FILE_SIZE_BYTES, // 5MB
    },
    fileFilter,
});
