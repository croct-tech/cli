import {JsonObject} from '@croct/json';
import {ProjectManager} from '@/application/project/manager/projectManager';
import {JsonObjectNode, JsonParser} from '@/infrastructure/json';
import {FileSystem} from '@/application/fs/fileSystem';
import {ParameterlessProvider} from '@/application/provider/parameterlessProvider';

export type Configuration = {
    projectManager: ProjectManager,
    fileSystem: FileSystem,
};

export class NodeScriptProvider implements ParameterlessProvider<Record<string, string>> {
    private readonly projectManager: ProjectManager;

    private readonly fileSystem: FileSystem;

    public constructor({projectManager, fileSystem}: Configuration) {
        this.projectManager = projectManager;
        this.fileSystem = fileSystem;
    }

    public async get(): Promise<Record<string, string>> {
        const packageFile = this.projectManager.getProjectPackagePath();
        let object: JsonObject;

        try {
            object = JsonParser.parse(await this.fileSystem.readTextFile(packageFile), JsonObjectNode)
                .get('scripts')
                .cast(JsonObjectNode)
                .toJSON();
        } catch {
            return {};
        }

        const scripts: Record<string, string> = {};

        for (const [key, value] of Object.entries(object)) {
            if (typeof value === 'string') {
                scripts[key] = value;
            }
        }

        return scripts;
    }
}
