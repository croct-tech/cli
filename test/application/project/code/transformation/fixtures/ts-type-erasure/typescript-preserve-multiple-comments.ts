// Unrelated comment

/**
 * Unrelated comment
 */

/**
 * The operands of the addition function.
 */
type AdditionOperands = {
    /**
     * The left operand.
     */
    left: number;
    /**
     * The right operand.
     */
    right: number;
}

// Another unrelated comment

/**
 * Another unrelated comment
 */

/**
 * This function takes two operands and returns their sum.
 *
 * @param operands
 */
export function addition(operands: AdditionOperands): number {
    return operands.left + operands.right;
}
