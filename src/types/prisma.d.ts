declare module '@prisma/client' {
  export enum Role {
    ADMIN = 'ADMIN',
    VIEWER = 'VIEWER',
  }

  export enum DbType {
    ORACLE = 'ORACLE',
    MYSQL = 'MYSQL',
    POSTGRES = 'POSTGRES',
    MSSQL = 'MSSQL',
  }

  export enum ValueType {
    NUMBER = 'NUMBER',
    STRING = 'STRING',
    BOOLEAN = 'BOOLEAN',
  }

  export enum AlertLevel {
    WARN = 'WARN',
    HIGH = 'HIGH',
    CRITICAL = 'CRITICAL',
    DOWN = 'DOWN',
  }

  export class PrismaClient {
    user: any;
    database: any;
    metric: any;
    template: any;
    databaseGroup: any;
    activeAlert: any;
    alertHistory: any;
    metricValueHistory: any;
    $connect(): Promise<void>;
    $disconnect(): Promise<void>;
  }
}
