import { POSITION_GAP } from "../constants.js";

/**
 * Calculate a position value to place an item between two others.
 *
 * We use float positions (1000, 2000, 3000...) instead of integers (1, 2, 3)
 * so that inserting between two items only requires updating ONE row.
 *
 * Example:
 *   List positions: 1000 | 2000 | 3000
 *   Move item between 1000 and 2000 -> new position = 1500
 *   Move item between 1000 and 1500 -> new position = 1250
 *   This can go on practically forever before needing a reindex
 *
 * @param {number|null} beforePosition - position of item BEFORE the target slot
 * @param {number|null} afterPosition  - position of item AFTER the target slot
 * @returns {number} - new float position
 */
const getPositionBetween = (beforePosition, afterPosition) => {
    // Inserting at the very beginning (nothing before it)
    if (beforePosition === null && afterPosition !== null) {
        return afterPosition / 2;
    }

    // Inserting at the very end (nothing after it)
    if (beforePosition !== null && afterPosition === null) {
        return beforePosition + POSITION_GAP;
    }

    // Inserting between two existing items
    if (beforePosition !== null && afterPosition !== null) {
        return (beforePosition + afterPosition) / 2;
    }

    // Very first item ever inserted in this list/board
    return POSITION_GAP;
};

/**
 * Generate initial position for item at a given index during seeding.
 * index 0 -> 1000
 * index 1 -> 2000
 * index 2 -> 3000
 *
 * @param {number} index - zero-based index
 * @returns {number}
 */
const getInitialPosition = (index) => {
    return (index + 1) * POSITION_GAP;
};

export { getPositionBetween, getInitialPosition };
