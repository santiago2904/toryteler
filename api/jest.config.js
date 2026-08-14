module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.ts$': 'ts-jest' },
  testEnvironment: 'node',
  // Neutralises the credentials that would otherwise reach a real service.
  setupFiles: ['<rootDir>/test/setup/env.ts'],
  testTimeout: 30000,
  // The suite shares one database and truncates between cases: parallel
  // workers would wipe each other's rows mid-test.
  maxWorkers: 1,
};
