import {ServerCommandParser} from '@/application/project/server/provider/projectServerProvider';
import {ServerInfo} from '@/application/project/server/factory/serverFactory';

export class NextCommandParser implements ServerCommandParser {
    public parse(command: string): ServerInfo|null {
        if (!command.includes('next dev')) {
            return null;
        }

        const portMatch = command.match(/(?:-p|--port)\s*(\d+)/);
        const hostMatch = command.match(/(?:-H|--hostname)\s*(\S+)/);
        const port = portMatch !== null ? Number.parseInt(portMatch[1], 10) : null;
        const host = hostMatch !== null ? hostMatch[1] : 'localhost';
        const protocol = command.includes('-https') ? 'https' : 'http';

        return {
            protocol: protocol,
            host: host,
            ...(port !== null ? {port: port} : {}),
            defaultPort: 3000,
        };
    }
}
