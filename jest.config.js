export default {
    transform: {
        '^.+\\.ts$': '@swc/jest',
    },
    restoreMocks: true,
    resetMocks: true,
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
    },
};
