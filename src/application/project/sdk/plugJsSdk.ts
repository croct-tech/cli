import {Installation, Sdk, SdkResolver} from '@/application/project/sdk/sdk';
import {JavaScriptSdk} from '@/application/project/sdk/javasScriptSdk';
import {ApplicationPlatform} from '@/application/model/entities';
import {ProjectConfiguration} from '@/application/project/configuration';

export class PlugJsSdk extends JavaScriptSdk implements SdkResolver {
    public getPackage(): string {
        return '@croct/plug';
    }

    public getPlatform(): ApplicationPlatform {
        return ApplicationPlatform.JAVASCRIPT;
    }

    public resolve(hint?: string): Promise<Sdk|null> {
        if (hint !== undefined) {
            return Promise.resolve(hint.toLowerCase() === this.getPlatform().toLowerCase() ? this : null);
        }

        return Promise.resolve(this);
    }

    public install(installation: Installation): Promise<ProjectConfiguration> {
        return Promise.resolve(installation.configuration);
    }
}
