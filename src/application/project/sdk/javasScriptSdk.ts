import {resolve} from 'path';
import {writeFile} from 'fs/promises';
import {Installation, Sdk} from '@/application/project/sdk/sdk';
import {ProjectManager} from '@/application/project/projectManager';
import {ApplicationPlatform} from '@/application/model/entities';
import {ProjectConfiguration} from '@/application/project/configuration';
import {Task} from '@/application/cli/io/output';
import {WorkspaceApi} from '@/application/api/workspace';

export type InstallationPlan = {
    tasks: Task[],
    configuration: ProjectConfiguration,
};

export type Configuration = {
    projectManager: ProjectManager,

};

export abstract class JavaScriptSdk implements Sdk {
    protected projectManager: ProjectManager;

    private workspaceApi: WorkspaceApi;

    public constructor(projectManager: ProjectManager) {
        this.projectManager = projectManager;
    }

    public abstract getPackage(): string;

    public abstract getPlatform(): ApplicationPlatform;

    public async install(installation: Installation): Promise<ProjectConfiguration> {
        const {input, output} = installation;

        const plan = await this.getInstallationPlan(installation);

        if (plan.tasks.length > 0) {
            output.break();
            output.inform('**Installation plan**');

            for (let index = 0; index < plan.tasks.length; index++) {
                output.log(` - ${plan.tasks[index].title}`);
            }

            output.break();

            if (!await input.confirm({message: 'Proceed?', default: true})) {
                output.alert('Installation aborted');

                return output.exit();
            }

            await output.monitor({tasks: plan.tasks});
        }

        return plan.configuration;
    }

    protected abstract getInstallationPlan(installation: Installation): Promise<InstallationPlan>;

    public async updateContent(installation: Installation): Promise<void> {
        const {configuration, output} = installation;
        const slots = Object.entries(configuration.slots);

        if (slots.length === 0) {
            return;
        }

        const packageInfo = await this.projectManager.getPackageInfo('@croct/content');

        if (packageInfo === null) {
            output.alert('The package @croct/content is not installed');

            return;
        }

        const indicator = output.notify(`Downloading content (0/${slots.length})`);

        let progress = 0;

        const contentList = await Promise.all(slots.map(async ([slot, version]) => {
            const content = this.workspaceApi.getSlotStaticContent(
                {
                    organizationSlug: configuration.organization,
                    workspaceSlug: configuration.workspace,
                    slotSlug: slot,
                },
                Number.parseInt(version, 10),
            );

            await content;

            indicator.update(`Downloading content (${++progress}/${slots.length})`);
        }));

        for (const [slot, version] of slots) {
            const filePath = resolve(packageInfo.path, `${slot}@${version}.json`);

            await writeFile(
                filePath,
                JSON.stringify(contentList, null, 2),
                {
                    encoding: 'utf-8',
                    flag: 'w',
                },
            );
        }

        indicator.confirm('Content downloaded');
    }

    public updateTypes(_: Installation): Promise<void> {
        return Promise.resolve(undefined);
    }
}
