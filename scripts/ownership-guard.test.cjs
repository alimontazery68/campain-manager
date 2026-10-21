const test = require('node:test');
const assert = require('node:assert/strict');
const { CampaignOwnershipGuard } = require('../apps/api/dist/src/campaign-ownership.guard');

function context(request) { return { switchToHttp: () => ({ getRequest: () => request }) }; }
function dbFor(ownerId) {
  return {
    campaign: { findUnique: async () => ({ ownerId }) },
    task: { findUnique: async () => ({ day: { campaignId: 'campaign-1' } }) },
    campaignDay: { findUnique: async () => ({ campaignId: 'campaign-1' }) },
    preparationTask: { findUnique: async () => ({ campaignId: 'campaign-1' }) },
  };
}

test('campaign owner can access campaign resources', async () => {
  const guard = new CampaignOwnershipGuard(dbFor('user-1'));
  assert.equal(await guard.canActivate(context({ userId: 'user-1', params: { id: 'campaign-1' }, route: { path: '/:id' }, method: 'GET' })), true);
  assert.equal(await guard.canActivate(context({ userId: 'user-1', params: { id: 'task-1' }, route: { path: '/tasks/:id/complete' }, method: 'PATCH' })), true);
});

test('different user is rejected from campaign resources', async () => {
  const guard = new CampaignOwnershipGuard(dbFor('user-1'));
  await assert.rejects(() => guard.canActivate(context({ userId: 'user-2', params: { id: 'campaign-1' }, route: { path: '/:id' }, method: 'GET' })), /به این کمپین دسترسی ندارید/);
});

test('method read, recommendation and acceptance retain campaign ownership checks', async()=>{
 const guard=new CampaignOwnershipGuard(dbFor('user-1'));
 for(const [path,method] of [['/:id/method','GET'],['/:id/method','POST'],['/:id/method/accept','POST']]){
  const request={params:{id:'campaign-1'},route:{path},method};
  assert.equal(await guard.canActivate(context({...request,userId:'user-1'})),true);
  await assert.rejects(()=>guard.canActivate(context({...request,userId:'user-2'})),{status:403});
 }
});
