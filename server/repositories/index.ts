import { IStorageRepository } from './types';
import { MemoryRepository } from './memoryRepository';
import { PrismaRepository } from './prismaRepository';

let instance: IStorageRepository | null = null;

export function getStorageRepository(): IStorageRepository {
  if (instance) return instance;

  const storageType = (process.env.STORAGE_TYPE || '').toLowerCase();
  const usePrisma = process.env.USE_PRISMA_DB === 'true' || storageType === 'prisma';

  if (usePrisma) {
    console.log('⚡ Initializing Prisma ORM MySQL Storage Provider (STORAGE_TYPE=prisma)');
    try {
      instance = new PrismaRepository();
    } catch (err) {
      console.warn('⚠️ Failed to initialize PrismaRepository, falling back to MemoryRepository:', err);
      instance = new MemoryRepository();
    }
  } else {
    console.log('💾 Initializing In-Memory Storage Provider (STORAGE_TYPE=memory)');
    instance = new MemoryRepository();
  }

  return instance;
}

export * from './types';
