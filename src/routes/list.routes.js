import { Router } from "express";
import {
    updateList,
    deleteList,
    moveList,
    createList,
} from "../controllers/list.controller.js";

const router = Router();

router.route("/:boardId/lists").post(createList);

router.route("/:listId").put(updateList).delete(deleteList);

router.route("/:listId/move").put(moveList);

export default router;
