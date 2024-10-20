import {Installation, Sdk, SdkResolver} from '@/application/project/sdk/sdk';
import {JavaScriptSdk} from '@/application/project/sdk/javasScriptSdk';
import {ApplicationPlatform} from '@/application/model/entities';
import {ProjectConfiguration} from '@/application/project/configuration';

export class PlugReactSdk extends JavaScriptSdk implements SdkResolver {
    public getPackage(): string {
        return '@croct/plug-react';
    }

    public getPlatform(): ApplicationPlatform {
        return ApplicationPlatform.REACT;
    }

    public async resolve(hint?: string): Promise<Sdk|null> {
        if (hint !== undefined) {
            return Promise.resolve(hint.toLowerCase() === this.getPlatform().toLowerCase() ? this : null);
        }

        const hints = await Promise.all([
            this.projectManager.isPackageListed(this.getPackage()),
            this.projectManager.isPackageListed('react'),
        ]);

        return hints.some(Boolean) ? this : null;
    }

    public install(installation: Installation): Promise<ProjectConfiguration> {
        return Promise.resolve(installation.configuration);
    }
}
