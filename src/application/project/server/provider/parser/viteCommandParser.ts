import {ServerCommandParser} from '@/application/project/server/provider/projectServerProvider';
import {ServerInfo} from '@/application/project/server/factory/serverFactory';

export class ViteCommandParser implements ServerCommandParser {
    public parse(command: string): ServerInfo|null {
        if (!command.includes('vite')) {
            return null;
        }

        const portMatch = command.match(/--port\s*(\d+)/);
        const hostMatch = command.match(/--host\s*(\S+)/);
        const port = portMatch !== null ? Number.parseInt(portMatch[1], 10) : null;
        const host = hostMatch !== null ? hostMatch[1] : 'localhost';

        return {
            protocol: 'http',
            host: host,
            ...(port !== null ? {port: port} : {}),
            defaultPort: 5173,
        };
    }
}
