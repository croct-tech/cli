import {Installation, Sdk, SdkResolver} from '@/application/project/sdk/sdk';
import {InstallationPlan, JavaScriptSdk} from '@/application/project/sdk/javasScriptSdk';
import {ApplicationPlatform} from '@/application/model/entities';

export class PlugJsSdk extends JavaScriptSdk implements SdkResolver<Sdk|null> {
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

    protected getInstallationPlan(installation: Installation): Promise<InstallationPlan> {
        return Promise.resolve({
            tasks: [],
            configuration: installation.configuration,
        });
    }
}
