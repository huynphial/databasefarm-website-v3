import fs from 'fs';

let schema = fs.readFileSync('prisma/schema.prisma', 'utf8');

// Add missing fields to ActiveAlert
schema = schema.replace(
  /model ActiveAlert \{[\s\S]*?message\s+String\s+@db\.Text/m,
  (match) => match.replace(
    /message\s+String\s+@db\.Text/,
    `objectName    String?    @map("object_name")\n  attributeName String?    @map("attribute_name")\n  status        String?    @default("OPEN")\n  dispatchStatus String?   @map("dispatch_status")\n  message    String     @db.Text`
  )
);

// Add missing fields to AlertHistory
schema = schema.replace(
  /model AlertHistory \{[\s\S]*?message\s+String\s+@db\.Text/m,
  (match) => match.replace(
    /message\s+String\s+@db\.Text/,
    `objectName       String?    @map("object_name")\n  attributeName    String?    @map("attribute_name")\n  resolutionStatus String?    @map("resolution_status")\n  dispatchStatus   String?    @map("dispatch_status")\n  message     String     @db.Text`
  )
);

// Add missing fields to Metric
schema = schema.replace(
  /model Metric \{[\s\S]*?templateId\s+String\?/m,
  (match) => match.replace(
    /templateId\s+String\?/,
    `templateId         String?\n  templateIds        Json?                   @map("template_ids")\n  noAlertRequired    Boolean                 @default(false) @map("no_alert_required")`
  )
);

fs.writeFileSync('prisma/schema.prisma', schema);
console.log('Schema updated successfully');
