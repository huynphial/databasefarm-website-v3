import fs from 'fs';
let seed = fs.readFileSync('prisma/seed.ts', 'utf8');

seed = seed.replace(
/const groupTemplateMappings = \[[\s\S]*?\];/,
`const groupTemplateMappings = [
    { groupId: 'grp-prod-01', templateId: 'tpl-ora-01' },
    { groupId: 'grp-prod-01', templateId: 'tpl-pg-01' },
    { groupId: 'grp-finance-02', templateId: 'tpl-pg-01' },
    { groupId: 'grp-analytics-03', templateId: 'tpl-ms-01' },
  ];`
);

// We want to make sure it's not repeatedly adding it.
seed = seed.replace(/templateIds: \[.*?\](?:,\s+noAlertRequired: false)?,\s*isEnabled: true/g, 'isEnabled: true');
seed = seed.replace(/templateIds: \[.*?\]\];/g, '];');

seed = seed.replace(
  /templateId: 'tpl-([a-z0-9-]+)',\s+isEnabled: true,/g,
  "templateId: 'tpl-$1',\n      templateIds: ['tpl-$1'],\n      noAlertRequired: false,\n      isEnabled: true,"
);

fs.writeFileSync('prisma/seed.ts', seed);
console.log("Fixed");
