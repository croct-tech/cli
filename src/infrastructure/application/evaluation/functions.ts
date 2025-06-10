import {JsonValue} from '@croct/json';
import {randomUUID} from 'node:crypto';
import {EvaluationError, GenericFunction} from '@/application/template/evaluation';
import {HelpfulError} from '@/application/error';

export const ext: GenericFunction = (path: JsonValue): string => {
    if (typeof path !== 'string') {
        throw new EvaluationError(
            'The `path` argument of the `ext` function must be a string, '
            + `but got ${HelpfulError.describeType(path)}.`,
        );
    }

    return path.split('.').pop() ?? '';
};

export const basename: GenericFunction = (path: JsonValue, omitExtension: JsonValue = false): string => {
    if (typeof path !== 'string') {
        throw new EvaluationError(
            'The `path` argument of the `basename` function must be a string, '
            + `but got ${HelpfulError.describeType(path)}.`,
        );
    }

    if (typeof omitExtension !== 'boolean') {
        throw new EvaluationError(
            'The `omitExtension` argument of the `basename` function must be a boolean, '
            + `but got ${HelpfulError.describeType(omitExtension)}.`,
        );
    }

    const result = path.split(/[\\/]/).pop() ?? '';

    if (omitExtension) {
        return result.replace(/\.[^/.]+$/, '');
    }

    return result;
};

export const dirname: GenericFunction = (path: JsonValue): string => {
    if (typeof path !== 'string') {
        throw new EvaluationError(
            'The `path` argument of the `dirname` function must be a string, '
            + `but got ${HelpfulError.describeType(path)}.`,
        );
    }

    return path.replace(/[\\/][^\\/]*$/, '');
};

export const uuid: GenericFunction = (): string => randomUUID();
