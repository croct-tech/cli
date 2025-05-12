import {ServerCommandParser} from '@/application/project/server/provider/projectServerProvider';
import {ServerInfo} from '@/application/project/server/factory/serverFactory';

export class ReactScriptCommandParser implements ServerCommandParser {
    public parse(command: string): ServerInfo|null {
        if (!command.includes('react-scripts start')) {
            return null;
        }

        const portMatch = command.match(/PORT=(\d+)/);
        const hostMatch = command.match(/HOST=(\S+)/);
        const httpsMatch = command.match(/HTTPS=(\S+)/);
        const port = portMatch !== null ? Number.parseInt(portMatch[1], 10) : null;
        const host = hostMatch !== null ? hostMatch[1] : 'localhost';
        const protocol = httpsMatch !== null && httpsMatch[1] === 'true' ? 'https' : 'http';

        return {
            protocol: protocol,
            host: host,
            ...(port !== null ? {port: port} : {}),
            defaultPort: 5173,
        };
    }
}
