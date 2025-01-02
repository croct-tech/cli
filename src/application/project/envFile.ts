import {FileSystem} from '@/application/fileSystem/fileSystem';

export class EnvFile {
    private readonly fileSystem: FileSystem;

    private readonly path: string;

    public constructor(fileSystem: FileSystem, path: string) {
        this.fileSystem = fileSystem;
        this.path = path;
    }

    public getName(): string {
        return this.fileSystem.getBaseName(this.path);
    }

    public exists(): Promise<boolean> {
        return this.fileSystem.exists(this.path);
    }

    public async hasVariable(name: string): Promise<boolean> {
        const content = await this.read();

        if (content === '') {
            return false;
        }

        const escapedVariable = EnvFile.escapeRegex(name);
        const regex = new RegExp(`^${escapedVariable}\\s*=`, 'm');

        return regex.test(content);
    }

    public async setVariables(variables: Record<string, string>): Promise<void> {
        const content = await this.read();

        try {
            for (const [name, value] of Object.entries(variables)) {
                await this.setVariable(name, value);
            }
        } catch (error) {
            await this.write(content);

            throw error;
        }
    }

    public async setVariable(name: string, value: string): Promise<void> {
        const content = await this.read();
        const escapedName = EnvFile.escapeRegex(name);

        if (content === '') {
            return this.write(`${name}=${value}`);
        }

        const updatedContent = content.replace(
            new RegExp(
                `${escapedName}\\s*=\\s*((?!['"\`]).*$|\`(?:\\.|[^\`])*\`|'(?:\\.|[^'])*'|"(?:\\.|[^"])*")`,
                'm',
            ),
            `${name}=${value}`,
        );

        if (updatedContent !== content) {
            return this.write(updatedContent);
        }

        return this.write(`${content}${content.endsWith('\n') ? '' : '\n'}${name}=${value}`);
    }

    private async write(content: string): Promise<void> {
        await this.fileSystem.writeFile(this.path, content, {
            overwrite: true,
        });
    }

    private async read(): Promise<string> {
        try {
            return await this.fileSystem.readFile(this.path);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                throw error;
            }

            return '';
        }
    }

    private static escapeRegex(value: string): string {
        return value.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    }
}
