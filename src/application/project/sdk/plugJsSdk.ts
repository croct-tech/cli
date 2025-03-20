import {Content} from '@croct/content-model/content/content';
import {JsonValue} from '@croct/json';
import {ContentDefinition} from '@croct/content-model/definition/definition';
import {Installation, SdkError} from '@/application/project/sdk/sdk';
import {
    Configuration as JavaScriptSdkConfiguration,
    InstallationPlan,
    JavaScriptSdk,
} from '@/application/project/sdk/javasScriptSdk';
import {PlugJsExampleGenerator} from '@/application/project/code/generation/slot/plugJsExampleGenerator';
import {CodeLanguage, ExampleFile} from '@/application/project/code/generation/example';
import {Slot} from '@/application/model/slot';
import {sortAttributes} from '@/application/project/code/generation/utils';
import {ErrorReason} from '@/application/error';

export type Configuration = JavaScriptSdkConfiguration & {
    bundlers: string[],
};

export class PlugJsSdk extends JavaScriptSdk {
    private readonly bundlers: string[];

    public constructor({bundlers, ...configuration}: Configuration) {
        super(configuration);

        this.bundlers = bundlers;
    }

    protected async generateSlotExampleFiles(slot: Slot, installation: Installation): Promise<ExampleFile[]> {
        const {configuration} = installation;
        const [isTypeScript, bundler, application] = await Promise.all([
            this.isTypeScriptProject(),
            this.detectBundler(),
            this.workspaceApi.getApplication({
                organizationSlug: configuration.organization,
                workspaceSlug: configuration.workspace,
                applicationSlug: configuration.applications.development,
            }),
        ]);

        if (application === null) {
            throw new SdkError(`Development application ${configuration.applications.development} not found.`, {
                reason: ErrorReason.NOT_FOUND,
            });
        }

        const directory = this.fileSystem.joinPaths(
            installation.configuration.paths.examples,
            slot.slug,
        );

        const generator = new PlugJsExampleGenerator({
            fileSystem: this.fileSystem,
            language: isTypeScript ? CodeLanguage.TYPESCRIPT : CodeLanguage.JAVASCRIPT,
            appId: application.publicId,
            fallbackContent: bundler === null
                ? PlugJsSdk.extractFallbackContent(
                    slot.content[installation.configuration.defaultLocale],
                    slot.resolvedDefinition,
                )
                : undefined,
            containerId: 'slot',
            slotPath: this.fileSystem.joinPaths(directory, `slot.${isTypeScript ? 'ts' : 'js'}`),
            pagePath: this.fileSystem.joinPaths(directory, 'index.html'),
        });

        const example = generator.generate({
            id: slot.slug,
            version: slot.version.major,
            definition: slot.resolvedDefinition,
        });

        return Promise.resolve(example.files);
    }

    private static extractFallbackContent(content: Content, definition: ContentDefinition): JsonValue {
        switch (content.type) {
            case 'text':
            case 'boolean':
            case 'number': {
                if (content.value.type === 'static') {
                    return content.value.value;
                }

                if (content.value.default !== undefined) {
                    return content.value.default;
                }

                return null;
            }

            case 'list':
                return content.items.map(
                    item => PlugJsSdk.extractFallbackContent(item, (definition as ContentDefinition<'list'>).items),
                );

            case 'structure': {
                const structureDefinition = definition as ContentDefinition<'structure'>;
                const structure: Record<string, JsonValue> = {};

                for (const [name, attribute] of sortAttributes(structureDefinition.attributes)) {
                    if (attribute.private === true) {
                        continue;
                    }

                    const value = PlugJsSdk.extractFallbackContent(
                        content.attributes[name],
                        structureDefinition.attributes[name].type,
                    );

                    if (attribute.optional !== true || value !== null) {
                        structure[name] = value;
                    }
                }

                return structure;
            }
        }
    }

    private async detectBundler(): Promise<string|null> {
        for (const bundler of this.bundlers) {
            if (await this.packageManager.hasDependency(bundler)) {
                return Promise.resolve(bundler);
            }
        }

        return Promise.resolve(null);
    }

    protected getInstallationPlan(installation: Installation): Promise<InstallationPlan> {
        return Promise.resolve({
            tasks: [],
            dependencies: ['@croct/plug'],
            configuration: installation.configuration,
        });
    }
}
