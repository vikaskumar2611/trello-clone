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

// POST /api/v1/boards/:boardId/members
const addBoardMember = asyncHandler(async (req, res) => {
    const { boardId } = req.params;
    const { member_id } = req.body;

    if (!member_id) {
        throw new ApiError(400, "member_id is required");
    }

    const boardResult = await query(
        `SELECT id FROM boards WHERE id = $1 AND is_archived = FALSE`,
        [boardId],
    );
    if (!boardResult.rows[0]) {
        throw new ApiError(404, "Board not found");
    }

    const memberResult = await query(
        `SELECT id, name, email, avatar_url, color
     FROM members
     WHERE id = $1`,
        [member_id],
    );
    if (!memberResult.rows[0]) {
        throw new ApiError(404, "Member not found");
    }

    await query(
        `INSERT INTO board_members (board_id, member_id, role)
     VALUES ($1, $2, 'member')
     ON CONFLICT (board_id, member_id) DO NOTHING`,
        [boardId, member_id],
    );

    const added = await query(
        `SELECT m.id, m.name, m.email, m.avatar_url, m.color, bm.role
     FROM members m
     JOIN board_members bm ON bm.member_id = m.id
     WHERE bm.board_id = $1 AND m.id = $2`,
        [boardId, member_id],
    );

    return res
        .status(200)
        .json(new ApiResponse(200, added.rows[0], "Member added to board"));
});

export { getAllMembers, getBoardMembers, addBoardMember };
