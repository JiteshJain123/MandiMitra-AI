import { MongoMemoryServer } from 'mongodb-memory-server';
import type { TestProject } from 'vitest/node';

let server: MongoMemoryServer | undefined;

export async function setup(project: TestProject) {
  // MONGOMS_SYSTEM_BINARY may point at a local mongod; otherwise a binary is downloaded.
  server = await MongoMemoryServer.create();
  project.provide('mongoUri', server.getUri());
}

export async function teardown() {
  await server?.stop();
}

declare module 'vitest' {
  export interface ProvidedContext {
    mongoUri: string;
  }
}
