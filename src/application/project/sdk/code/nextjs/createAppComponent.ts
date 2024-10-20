import {Codemod, ResultCode} from '@/application/project/sdk/code/transformation';

export type AppComponentOptions = {
    typescript?: boolean,
};

export class CreateAppComponent implements Codemod<string, AppComponentOptions> {
    public apply(input: string, options: AppComponentOptions = {}): ResultCode<string> {
        const isTypescript = options.typescript ?? false;

        const code = [
            ...(
                isTypescript
                    ? [
                        'import type {ReactElement} from \'react\';',
                        'import type {AppProps} from \'next/app\';',
                    ]
                    : []
            ),
            'import {CroctProvider} from \'@croct/plug-next/CroctProvider\';',
            '',
            isTypescript
                ? 'export default function App({Component, pageProps}: AppProps): ReactElement {'
                : 'export default function App({Component, pageProps}) {',
            '  return (',
            '    <CroctProvider>',
            '      <Component {...pageProps} />',
            '     </CroctProvider>',
            '  );',
            '}',
        ].join('\n');

        return {
            modified: input !== code,
            result: code,
        };
    }
}
