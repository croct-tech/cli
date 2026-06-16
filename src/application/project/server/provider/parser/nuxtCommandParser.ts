import type {ServerCommandParser} from '@/application/project/server/provider/projectServerProvider';
import type {ServerInfo} from '@/application/project/server/factory/serverFactory';

export class NuxtCommandParser implements ServerCommandParser {
    public parse(command: string): ServerInfo | null {
        if (!command.includes('nuxt dev') && !command.includes('nuxi dev')) {
            return null;
        }

        const portMatch = command.match(/(?:-p|--port)\s*(\d+)/);
        const hostMatch = command.match(/--host\s*(\S+)/);
        const port = portMatch !== null ? Number.parseInt(portMatch[1], 10) : null;
        const host = hostMatch !== null ? hostMatch[1] : 'localhost';

        return {
            protocol: 'http',
            host: host,
            ...(port !== null ? {port: port} : {}),
            defaultPort: 3000,
        };
    }
}
