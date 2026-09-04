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
    MARIADB = 'MARIADB',
    DB2 = 'DB2',
    MONGODB = 'MONGODB',
    REDIS = 'REDIS',
    SINGLESTORE = 'SINGLESTORE',
    CLICKHOUSE = 'CLICKHOUSE',
    ELASTICSEARCH = 'ELASTICSEARCH',
    OPENSEARCH = 'OPENSEARCH',
    CASSANDRA = 'CASSANDRA',
    SAPHANA = 'SAPHANA',
    SNOWFLAKE = 'SNOWFLAKE',
    BIGQUERY = 'BIGQUERY',
    REDSHIFT = 'REDSHIFT',
    DATABRICKS = 'DATABRICKS',
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
    $connect(): Promise<void>;
    $disconnect(): Promise<void>;
  }
}
