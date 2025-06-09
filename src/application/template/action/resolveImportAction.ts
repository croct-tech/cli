import {Action} from '@/application/template/action/action';
import {FileSystem, ScanFilter} from '@/application/fs/fileSystem';
import {ActionContext} from '@/application/template/action/context';
import {WorkingDirectory} from '@/application/fs/workingDirectory/workingDirectory';
import {MatchesGlob} from '@/application/predicate/matchesGlob';
import {Codemod} from '@/application/project/code/transformation/codemod';
import {ErrorReason, HelpfulError} from '@/application/error';

export type ResolveImportOptions = {
    path: string,
};

export type Configuration = {
    projectDirectory: WorkingDirectory,
    fileSystem: FileSystem,
    codemod: Codemod<string>,
    scanFilter?: ScanFilter,
};

export class ResolveImportAction implements Action<ResolveImportOptions> {
    private readonly projectDirectory: WorkingDirectory;

    private readonly fileSystem: FileSystem;

    private readonly codemod: Codemod<string>;

    private readonly scanFilter?: ScanFilter;

    public constructor({projectDirectory, fileSystem, codemod, scanFilter}: Configuration) {
        this.projectDirectory = projectDirectory;
        this.fileSystem = fileSystem;
        this.codemod = codemod;
        this.scanFilter = scanFilter;
    }

    public async execute(options: ResolveImportOptions, context: ActionContext): Promise<void> {
        const {output} = context;

        const notifier = output?.notify('Resolving imports');

        try {
            await this.resolveImports(options.path);
        } finally {
            notifier?.stop();
        }
    }

    private async resolveImports(pattern: string): Promise<void> {
        let matched = false;
        const matcher = MatchesGlob.fromPattern(this.fileSystem.normalizeSeparators(pattern));

        for await (const entry of this.fileSystem.list(this.projectDirectory.get(), this.scanFilter)) {
            if (!await matcher.test(entry.name)) {
                continue;
            }

            if (entry.type === 'file') {
                matched = true;
                await this.codemod.apply(await this.fileSystem.getRealPath(entry.name));
            }
        }

        if (!matched) {
            throw new HelpfulError('No matching files found for resolving imports.', {
                reason: ErrorReason.UNEXPECTED_RESULT,
                details: [
                    `Pattern: ${pattern}`,
                ],
            });
        }
    }
}
