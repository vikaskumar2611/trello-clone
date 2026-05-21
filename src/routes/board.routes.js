// src/routes/board.routes.js
import { Router } from "express";
import {
    createBoard,
    getAllBoards,
    getBoardById,
    updateBoard,
    deleteBoard,
} from "../controllers/board.controller.js";

const router = Router();

router.route("/").get(getAllBoards).post(createBoard);

router
    .route("/:boardId")
    .get(getBoardById)
    .put(updateBoard)
    .delete(deleteBoard);

export default router;
