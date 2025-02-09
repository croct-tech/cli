import {JsonValue} from '@croct/json';
import {EvaluationError, GenericFunction} from '@/application/template/evaluation';
import {HelpfulError} from '@/application/error';

export const ext: GenericFunction = (path: JsonValue): JsonValue => {
    if (typeof path !== 'string') {
        throw new EvaluationError(
            'The `path` argument of the `ext` function must be a string, '
            + `but got ${HelpfulError.describeType(path)}.`,
        );
    }

    return path.split('.').pop() ?? '';
};

export const basename: GenericFunction = (path: JsonValue): JsonValue => {
    if (typeof path !== 'string') {
        throw new EvaluationError(
            'The `path` argument of the `basename` function must be a string, '
            + `but got ${HelpfulError.describeType(path)}.`,
        );
    }

    return path.split(/[\\/]/).pop() ?? '';
};

export const dirname: GenericFunction = (path: JsonValue): JsonValue => {
    if (typeof path !== 'string') {
        throw new EvaluationError(
            'The `path` argument of the `dirname` function must be a string, '
            + `but got ${HelpfulError.describeType(path)}.`,
        );
    }

    return path.replace(/[\\/][^\\/]*$/, '');
};
