import {ProjectIndex} from '@/application/project/index/projectIndex';
import {FileSystem} from '@/application/fs/fileSystem';
import {Validator} from '@/application/validation';

export type Configuration = {
    fileSystem: FileSystem,
    filePath: string,
    validator: Validator<string[]>,
};

export class FileProjectIndex implements ProjectIndex {
    private readonly fileSystem: FileSystem;

    private readonly validator: Validator<string[]>;

    private readonly filePath: string;

    public constructor({fileSystem, validator, filePath}: Configuration) {
        this.fileSystem = fileSystem;
        this.validator = validator;
        this.filePath = filePath;
    }

    public async getPaths(): Promise<string[]> {
        if (!await this.fileSystem.exists(this.filePath)) {
            return [];
        }

        let content: string;

        try {
            content = await this.fileSystem.readTextFile(this.filePath);
        } catch (error) {
            return [];
        }

        const validation = await this.validator.validate(JSON.parse(content));

        return validation.valid ? validation.data : [];
    }

    public async addPath(path: string): Promise<void> {
        await this.fileSystem.writeTextFile(
            this.filePath,
            JSON.stringify([...new Set([...await this.getPaths(), path])]),
        );
    }
}
