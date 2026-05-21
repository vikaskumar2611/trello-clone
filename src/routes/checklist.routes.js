import { Router } from "express";
import {
    updateChecklist,
    deleteChecklist,
    addChecklistItem,
    updateChecklistItem,
    deleteChecklistItem,
} from "../controllers/checklist.controller.js";

const router = Router();

// Checklist operations
router.route("/:checklistId").put(updateChecklist).delete(deleteChecklist);

// Checklist item operations
router.route("/:checklistId/items").post(addChecklistItem);

// Item-level routes
router
    .route("/items/:itemId")
    .put(updateChecklistItem)
    .delete(deleteChecklistItem);

export default router;
