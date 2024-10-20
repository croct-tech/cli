import {Codemod, ResultCode} from '@/application/project/sdk/code/transformation';

export class CreateMiddleware implements Codemod<string> {
    public apply(input: string): ResultCode<string> {
        const code = 'export {config, middleware} from \'@croct/plug-next/middleware\';';

        return {
            modified: input !== code,
            result: code,
        };
    }
}
