import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL || 'mysql://dbmon_user:secret_password@127.0.0.1:3306/db_monitoring_system',
  },
});
