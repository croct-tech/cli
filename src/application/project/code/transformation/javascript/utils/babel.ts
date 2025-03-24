import traverseModule from '@babel/traverse';

export const traverse = (traverseModule as any).default ?? traverseModule;
