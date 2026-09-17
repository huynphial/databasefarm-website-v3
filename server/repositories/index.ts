import { IStorageRepository } from './types';
import { MemoryRepository } from './memoryRepository';
import { PrismaRepository } from './prismaRepository';

let instance: IStorageRepository | null = null;

export function getStorageRepository(): IStorageRepository {
  if (instance) return instance;

  const envStorage = (process.env.STORAGE_TYPE || 'memory').toLowerCase();
  const usePrisma = (process.env.USE_PRISMA_DB === 'true' || envStorage === 'prisma') && envStorage !== 'memory';

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

export function setStorageRepositoryType(type: 'prisma' | 'memory'): IStorageRepository {
  process.env.STORAGE_TYPE = type;
  if (type === 'prisma') {
    console.log('⚡ Dynamically switching to Prisma ORM Storage Provider');
    try {
      instance = new PrismaRepository();
    } catch (err) {
      console.warn('⚠️ Failed to switch to PrismaRepository, falling back to MemoryRepository:', err);
      instance = new MemoryRepository();
    }
  } else {
    console.log('💾 Dynamically switching to In-Memory Storage Provider');
    instance = new MemoryRepository();
  }
  return instance;
}

export * from './types';
