/** @type {import('jest').Config} */
module.exports = {
  rootDir: 'src',
  testEnvironment: 'node',
  transform: { '^.+\\.ts$': 'ts-jest' },
  testRegex: '.*\\.spec\\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^@crm/auth$': '<rootDir>/../../../packages/auth/src/index.ts',
    '^@crm/config$': '<rootDir>/../../../packages/config/src/index.ts',
    '^@crm/database$': '<rootDir>/../../../packages/database/src/index.ts',
    '^@crm/types$': '<rootDir>/../../../packages/types/src/index.ts',
    '^@crm/utils$': '<rootDir>/../../../packages/utils/src/index.ts',
    '^@crm/validation$': '<rootDir>/../../../packages/validation/src/index.ts',
  },
};
