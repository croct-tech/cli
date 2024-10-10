export enum AccessDeniedReason {
    INTERNAL_ERROR = 'INTERNAL_ERROR',
    UNKNOWN_USER = 'UNKNOWN_USER',
    BAD_CREDENTIALS = 'BAD_CREDENTIALS',
    UNVERIFIED_USER = 'UNVERIFIED_USER',
}

export enum ProblemType {
    UNEXPECTED_ERROR = 'https://croct.help/api/admin#unexpected-error',
    INVALID_INPUT = 'https://croct.help/api/admin#invalid-input',
    AUTHENTICATION_REQUIRED = 'https://croct.help/api/admin#authentication-required',
    ACCESS_DENIED = 'https://croct.help/api/admin#access-denied',
    RESOURCE_NOT_FOUND = 'https://croct.help/api/admin#resource-not-found',
    FAILED_PRECONDITION = 'https://croct.help/api/admin#failed-precondition',
    OPERATION_CONFLICT = 'https://croct.help/api/admin#operation-conflict',
    UNAVAILABLE_FEATURE = 'https://croct.help/api/admin#unavailable-feature',
}

export type Problem = {
    type: ProblemType,
    message: string,
    detail: string,
    status: number,
    reason?: AccessDeniedReason,
};

export class ApiError extends Error {
    public readonly details: Problem[];

    public constructor(message: string, errors: Problem[] = []) {
        super(message);

        Object.setPrototypeOf(this, ApiError.prototype);

        this.details = errors;
    }

    public isErrorType(type: ProblemType): boolean {
        return this.details.some(problem => problem.type === type);
    }

    public isAccessDenied(reason?: AccessDeniedReason): boolean {
        return this.details.some(
            problem => (
                problem.type === ProblemType.ACCESS_DENIED && (reason === undefined || problem.reason === reason)
            ),
        );
    }
}
