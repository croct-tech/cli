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

/**
 * This function takes two operands and returns their sum.
 *
 * @param operands
 */
export function addition(operands: AdditionOperands): number {
    return operands.left + operands.right;
}
