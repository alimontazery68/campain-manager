// Integration checks create and remove only their own test campaigns.
const {spawnSync}=require('node:child_process');
for(const name of ['ai-planning','analysis','completion','content-flow','preparation','daily-results','campaign-flow','detailed-setup','controls-learning','setup-safety','planning-data-flow','campaign-management']) {
  console.log('\nChecking '+name);
  const result=spawnSync(process.execPath,[`scripts/verify-${name}.cjs`],{stdio:'inherit',env:process.env});
  if(result.status!==0)process.exit(result.status||1);
}
