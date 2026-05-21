import { Router } from "express";
import {
    createBoard,
    getAllBoards,
    getBoardById,
    updateBoard,
    deleteBoard,
} from "../controllers/board.controller.js";

// Board-scoped sub-resources
import { createList } from "../controllers/list.controller.js";

const router = Router();

router.route("/").get(getAllBoards).post(createBoard);

router
    .route("/:boardId")
    .get(getBoardById)
    .put(updateBoard)
    .delete(deleteBoard);

//Lists scoped under a board
router.route("/:boardId/lists").post(createList);
export default router;
