import {Installation, Sdk, SdkResolver, ServerInfo} from '@/application/project/sdk/sdk';
import {InstallationPlan, JavaScriptSdk} from '@/application/project/sdk/javasScriptSdk';
import {PlugJsExampleGenerator} from '@/application/project/example/slot/plugJsExampleGenerator';
import {CodeLanguage, ExampleFile} from '@/application/project/example/example';
import {ApplicationPlatform} from '@/application/model/application';
import {Slot} from '@/application/model/slot';

export class PlugJsSdk extends JavaScriptSdk implements SdkResolver<Sdk|null> {
    public getPackage(): string {
        return '@croct/plug';
    }

    public getPlatform(): ApplicationPlatform {
        return ApplicationPlatform.JAVASCRIPT;
    }

    public getLocalServerInfo(): Promise<ServerInfo | null> {
        return Promise.resolve(null);
    }

    public resolve(hint?: string): Promise<Sdk|null> {
        if (hint !== undefined) {
            return Promise.resolve(hint.toLowerCase() === this.getPlatform().toLowerCase() ? this : null);
        }

        return Promise.resolve(this);
    }

    protected generateSlotExampleFiles(slot: Slot, installation: Installation): Promise<ExampleFile[]> {
        const generator = new PlugJsExampleGenerator({
            fileSystem: this.fileSystem,
            options: {
                language: CodeLanguage.JAVASCRIPT,
                appId: installation.configuration.applications.developmentPublicId,
                code: {
                    browser: true,
                    paths: {
                        slot: installation.configuration.paths.examples,
                        page: installation.configuration.paths.examples,
                    },
                },
            },
        });

        const example = generator.generate({
            id: slot.slug,
            version: slot.version.major,
            definition: slot.resolvedDefinition,
        });

        return Promise.resolve(example.files);
    }

    protected getInstallationPlan(installation: Installation): Promise<InstallationPlan> {
        return Promise.resolve({
            tasks: [],
            configuration: installation.configuration,
        });
    }
}
