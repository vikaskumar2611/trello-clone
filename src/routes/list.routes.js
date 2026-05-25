import { Router } from "express";
import {
    deleteListPermanently,
    updateList,
    deleteList,
    moveList,
    createList,
    restoreList,
} from "../controllers/list.controller.js";
import { createCard } from "../controllers/card.controller.js";

const router = Router();

router.route("/:boardId/lists").post(createList);

router.route("/:listId").put(updateList).delete(deleteList);
router.route("/:listId/permanent").delete(deleteListPermanently);

router.route("/:listId/restore").put(restoreList);

router.route("/:listId/move").put(moveList);

// Cards created under a list
router.route("/:listId/cards").post(createCard);

export default router;
