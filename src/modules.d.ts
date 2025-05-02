/* eslint-disable import/no-default-export -- It's external code */
declare module '@babel/plugin-transform-typescript' {
    import {PluginObj} from '@babel/core';

    const plugin: () => PluginObj;

    export default plugin;
}

declare module '@babel/plugin-syntax-decorators' {
    import {PluginObj} from '@babel/core';

    const plugin: () => PluginObj;

    export default plugin;
}
