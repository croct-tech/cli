type AdditionOperands = {
    left: number;
    right: number;
}

export function addition(operands: AdditionOperands): number {
    return operands.left + operands.right;
}
