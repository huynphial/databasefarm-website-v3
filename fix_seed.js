const fs = require('fs');
let seed = fs.readFileSync('prisma/seed.ts', 'utf8');

// The issue was sed added it to groupTemplateMappings.
// Restore the original mappings correctly.

seed = seed.replace(
/const groupTemplateMappings = \[[\s\S]*?\];/,
`const groupTemplateMappings = [
    { groupId: 'grp-prod-01', templateId: 'tpl-ora-01' },
    { groupId: 'grp-prod-01', templateId: 'tpl-pg-01' },
    { groupId: 'grp-finance-02', templateId: 'tpl-pg-01' },
    { groupId: 'grp-analytics-03', templateId: 'tpl-ms-01' },
  ];`
);

// Add templateIds and noAlertRequired back to metrics if it's missing.
seed = seed.replace(
  /templateId: 'tpl-([a-z0-9-]+)',\s+isEnabled: true,/g,
  "templateId: 'tpl-$1',\n      templateIds: ['tpl-$1'],\n      noAlertRequired: false,\n      isEnabled: true,"
);


fs.writeFileSync('prisma/seed.ts', seed);
console.log("Fixed");
