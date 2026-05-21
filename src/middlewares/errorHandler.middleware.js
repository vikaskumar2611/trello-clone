import { ApiError } from "../utils/ApiError.js";

/**
 * Global error handling middleware.
 * Mounted LAST in app.js so it catches errors from all routes.
 *
 * Controllers throw ApiError -> asyncHandler catches -> calls next(err) -> lands here
 */
const errorHandler = (err, req, res, next) => {
    // If it's our custom ApiError, use its properties directly
    if (err instanceof ApiError) {
        return res.status(err.statusCode).json({
            success: false,
            statusCode: err.statusCode,
            message: err.message,
            errors: err.errors,
            // Only expose stack trace in development
            ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
        });
    }

    // Handle PostgreSQL specific errors
    if (err.code === "23505") {
        // unique_violation - e.g. duplicate email
        return res.status(409).json({
            success: false,
            statusCode: 409,
            message: "Duplicate entry - resource already exists",
            errors: [err.detail || err.message],
        });
    }

    if (err.code === "23503") {
        // foreign_key_violation - e.g. invalid board_id
        return res.status(400).json({
            success: false,
            statusCode: 400,
            message: "Referenced resource does not exist",
            errors: [err.detail || err.message],
        });
    }

    if (err.code === "22P02") {
        // invalid_text_representation - e.g. invalid UUID format
        return res.status(400).json({
            success: false,
            statusCode: 400,
            message: "Invalid ID format",
            errors: [err.message],
        });
    }

    // Multer file size error
    if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
            success: false,
            statusCode: 400,
            message: "File too large. Maximum size is 5MB",
            errors: [],
        });
    }

    // Anything else is a 500
    console.error("Unhandled Error:", err);
    return res.status(500).json({
        success: false,
        statusCode: 500,
        message: "Internal Server Error",
        errors: [],
        ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
};

export { errorHandler };
