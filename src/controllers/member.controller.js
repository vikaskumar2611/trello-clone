import { query } from "../database/db.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// GET /api/v1/members
const getAllMembers = asyncHandler(async (req, res) => {
    const result = await query(
        `SELECT id, name, email, avatar_url, color, created_at
     FROM members
     ORDER BY name`,
    );

    return res
        .status(200)
        .json(
            new ApiResponse(200, result.rows, "Members fetched successfully"),
        );
});

// GET /api/v1/boards/:boardId/members
const getBoardMembers = asyncHandler(async (req, res) => {
    const { boardId } = req.params;

    const boardResult = await query(
        `SELECT id FROM boards WHERE id = $1 AND is_archived = FALSE`,
        [boardId],
    );
    if (!boardResult.rows[0]) {
        throw new ApiError(404, "Board not found");
    }

    const result = await query(
        `SELECT m.id, m.name, m.email, m.avatar_url, m.color, bm.role, bm.joined_at
     FROM members m
     JOIN board_members bm ON bm.member_id = m.id
     WHERE bm.board_id = $1
     ORDER BY bm.joined_at`,
        [boardId],
    );

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                result.rows,
                "Board members fetched successfully",
            ),
        );
});

export { getAllMembers, getBoardMembers };
