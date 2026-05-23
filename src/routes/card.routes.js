import { Router } from "express";
import {
    getCardById,
    updateCard,
    moveCard,
    deleteCard,
    addLabel,
    removeLabel,
    assignMember,
    removeMember,
    restoreCard,
} from "../controllers/card.controller.js";
import { createChecklist } from "../controllers/checklist.controller.js";
import { getComments, addComment } from "../controllers/comment.controller.js";
import { uploadAttachment } from "../controllers/attachment.controller.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

router.route("/:cardId").get(getCardById).put(updateCard).delete(deleteCard);

router.route("/:cardId/move").put(moveCard);

router.route("/:cardId/restore").put(restoreCard);

// Labels
router.route("/:cardId/labels").post(addLabel);
router.route("/:cardId/labels/:labelId").delete(removeLabel);

// Members
router.route("/:cardId/members").post(assignMember);
router.route("/:cardId/members/:memberId").delete(removeMember);

// Checklists
router.route("/:cardId/checklists").post(createChecklist);

// Comments
router.route("/:cardId/comments").get(getComments).post(addComment);

// Attachments - multer middleware runs before controller
router
    .route("/:cardId/attachments")
    .post(upload.single("attachment"), uploadAttachment);

export default router;
