type AdditionProps = {
    left: number;
    right: number;
}

export function Addition(operands: AdditionProps): React.ReactElement {
    return <div>{operands.left + operands.right}</div>;
}
