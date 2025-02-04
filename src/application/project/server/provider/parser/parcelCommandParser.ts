import {ServerInfo, ServerCommandParser} from '@/application/project/server/provider/projectServerProvider';

export class ParcelCommandParser implements ServerCommandParser {
    public parse(command: string): ServerInfo|null {
        if (!command.includes('parcel')) {
            return null;
        }

        const portMatch = command.match(/(?:-p|--port)\s*(\d+)/);
        const hostMatch = command.match(/--host\s*(\S+)/);
        const port = portMatch !== null ? Number.parseInt(portMatch[1], 10) : null;
        const host = hostMatch !== null ? hostMatch[1] : 'localhost';
        const protocol = command.includes('--https') ? 'https' : 'http';

        return {
            protocol: protocol,
            host: host,
            ...(port !== null ? {port: port} : {}),
            defaultPort: 1234,
        };
    }
}
