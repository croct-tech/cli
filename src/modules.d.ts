declare module '@babel/plugin-transform-typescript' {
    import type {PluginObj} from '@babel/core';

    const plugin: () => PluginObj;

    // eslint-disable-next-line import-x/no-default-export -- It's external code
    export default plugin;
}

declare module '@babel/plugin-syntax-decorators' {
    import type {PluginObj} from '@babel/core';

    const plugin: () => PluginObj;

    // eslint-disable-next-line import-x/no-default-export -- It's external code
    export default plugin;
}
