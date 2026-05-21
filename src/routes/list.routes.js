import { Router } from "express";
import {
    updateList,
    deleteList,
    moveList,
    createList,
} from "../controllers/list.controller.js";

// Cards scoped under a list
import { createCard } from "../controllers/card.controller.js";

const router = Router();

router.route("/:boardId/lists").post(createList);

router.route("/:listId").put(updateList).delete(deleteList);

router.route("/:listId/move").put(moveList);

// Cards created under a list
router.route("/:listId/cards").post(createCard);

export default router;
