import { Router } from "express";
import {
    createBoard,
    getAllBoards,
    getBoardById,
    updateBoard,
    deleteBoard,
} from "../controllers/board.controller.js";

import { getArchivedLists } from "../controllers/list.controller.js";

import { getArchivedCards } from "../controllers/card.controller.js";

import {
    getBoardLabels,
    createLabel,
} from "../controllers/label.controller.js";
import {
    getBoardMembers,
    addBoardMember,
} from "../controllers/member.controller.js";
import { searchCards } from "../controllers/search.controller.js";

const router = Router();

router.route("/").get(getAllBoards).post(createBoard);

router
    .route("/:boardId")
    .get(getBoardById)
    .put(updateBoard)
    .delete(deleteBoard);

//Lists scoped under a board
//router.route("/:boardId/lists").post(createList);

// Labels scoped under a board
router.route("/:boardId/labels").get(getBoardLabels).post(createLabel);

// Members scoped under a board
router.route("/:boardId/members").get(getBoardMembers).post(addBoardMember);

// Search scoped under a board
router.route("/:boardId/search").get(searchCards);

router.route("/:boardId/archived-lists").get(getArchivedLists);
router.route("/:boardId/archived-cards").get(getArchivedCards);

export default router;
