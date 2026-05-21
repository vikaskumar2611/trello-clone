import { query } from "../database/db.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary, deleteOnCloudinary } from "../utils/cloudinary.js";
import { DEFAULT_MEMBER_ID } from "../constants.js";

// POST /api/v1/cards/:cardId/attachments
// multer middleware runs before this - file is in req.file
const uploadAttachment = asyncHandler(async (req, res) => {
    const { cardId } = req.params;

    if (!req.file) {
        throw new ApiError(400, "No file uploaded");
    }

    const cardResult = await query(
        `SELECT id FROM cards WHERE id = $1 AND is_archived = FALSE`,
        [cardId],
    );
    if (!cardResult.rows[0]) {
        throw new ApiError(404, "Card not found");
    }

    // Upload from temp folder to Cloudinary
    // uploadOnCloudinary also deletes the local temp file after upload
    const uploadResult = await uploadOnCloudinary(req.file.path);

    if (!uploadResult) {
        throw new ApiError(500, "File upload failed. Please try again.");
    }

    const result = await query(
        `INSERT INTO attachments (card_id, member_id, filename, file_url, file_size, mime_type)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
        [
            cardId,
            DEFAULT_MEMBER_ID,
            req.file.originalname,
            uploadResult.secure_url, // Cloudinary HTTPS URL
            req.file.size,
            req.file.mimetype,
        ],
    );

    return res
        .status(201)
        .json(
            new ApiResponse(
                201,
                result.rows[0],
                "Attachment uploaded successfully",
            ),
        );
});

// DELETE /api/v1/attachments/:attachmentId
const deleteAttachment = asyncHandler(async (req, res) => {
    const { attachmentId } = req.params;

    const attachmentResult = await query(
        `SELECT * FROM attachments WHERE id = $1`,
        [attachmentId],
    );

    if (!attachmentResult.rows[0]) {
        throw new ApiError(404, "Attachment not found");
    }

    // Delete from Cloudinary first
    await deleteOnCloudinary(attachmentResult.rows[0].file_url);

    // Then delete from DB
    await query(`DELETE FROM attachments WHERE id = $1`, [attachmentId]);

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                { id: attachmentId },
                "Attachment deleted successfully",
            ),
        );
});

export { uploadAttachment, deleteAttachment };
