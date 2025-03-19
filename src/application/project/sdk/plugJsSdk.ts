import {Installation} from '@/application/project/sdk/sdk';
import {InstallationPlan, JavaScriptSdk} from '@/application/project/sdk/javasScriptSdk';
import {PlugJsExampleGenerator} from '@/application/project/code/generation/slot/plugJsExampleGenerator';
import {CodeLanguage, ExampleFile} from '@/application/project/code/generation/example';
import {Slot} from '@/application/model/slot';

export class PlugJsSdk extends JavaScriptSdk {
    protected async generateSlotExampleFiles(slot: Slot, installation: Installation): Promise<ExampleFile[]> {
        const generator = new PlugJsExampleGenerator({
            fileSystem: this.fileSystem,
            options: {
                language: await this.isTypeScriptProject() ? CodeLanguage.TYPESCRIPT : CodeLanguage.JAVASCRIPT,
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
            dependencies: ['@croct/plug'],
            configuration: installation.configuration,
        });
    }
}
