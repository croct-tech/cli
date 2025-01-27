import {ServerConfiguration, ServerCommandParser} from '@/application/project/server/provider/projectServerProvider';
import {JavaScriptProjectManager} from '@/application/project/manager/javaScriptProjectManager';

export class ViteCommandParser implements ServerCommandParser {
    private readonly projectManager: JavaScriptProjectManager;

    public constructor(projectManager: JavaScriptProjectManager) {
        this.projectManager = projectManager;
    }

    public async parse(script: string, command: string): Promise<ServerConfiguration|null> {
        if (!command.includes('vite')) {
            return null;
        }

        const portMatch = command.match(/--port\s*(\d+)/);
        const hostMatch = command.match(/--host\s*(\S+)/);
        const port = portMatch !== null ? Number.parseInt(portMatch[1], 10) : null;
        const host = hostMatch !== null ? hostMatch[1] : 'localhost';

        return {
            command: await this.projectManager.getScriptCommand(script),
            protocol: 'http',
            host: host,
            ...(port !== null ? {port: port} : {}),
            defaultPort: 5173,
        };
    }
}
