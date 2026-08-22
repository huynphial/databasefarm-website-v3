import fs from 'fs';

let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

schema = schema.replace(
  /model MetricDataPoint \{[\s\S]*?database\s+Database/m,
  (match) => match.replace(
    /databaseId\s+String\s+@map\("database_id"\)/,
    `dbId          String   @map("database_id")`
  ).replace(
    /@@index\(\[databaseId, metricId, measuredAt\(sort: Desc\)\]\)/,
    `@@index([dbId, metricId, measuredAt(sort: Desc)])`
  ).replace(
    /database\s+Database/,
    `database      Database`
  )
);

// We need to also update the relation field:
schema = schema.replace(
  /database      Database\s+@relation\(fields:\s*\[databaseId\],/g,
  `database      Database @relation(fields: [dbId],`
);


fs.writeFileSync('prisma/schema.prisma', schema);
console.log('Schema updated successfully');
