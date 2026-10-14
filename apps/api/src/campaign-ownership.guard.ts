import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class CampaignOwnershipGuard implements CanActivate {
  constructor(private db: PrismaService) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const userId = req.userId as string | undefined;
    if (!userId) return true;
    const path = String(req.route?.path || req.path || '');
    const id = req.params?.id as string | undefined;
    if (!id || req.method === 'POST' && path === '/') return true;
    let campaignId: string | undefined;
    if (path.includes('/tasks/')) {
      const task = await this.db.task.findUnique({ where: { id }, select: { day: { select: { campaignId: true } } } });
      campaignId = task?.day.campaignId;
    } else if (path.includes('/days/') || path.includes('/preparation/')) {
      const day = path.includes('/days/') ? await this.db.campaignDay.findUnique({ where: { id }, select: { campaignId: true } }) : null;
      const preparation = path.includes('/preparation/') ? await this.db.preparationTask.findUnique({ where: { id }, select: { campaignId: true } }) : null;
      campaignId = day?.campaignId || preparation?.campaignId;
    } else if (path.startsWith('/:id') || path.includes('/:id/')) {
      campaignId = id;
    }
    if (!campaignId) return true;
    const campaign = await this.db.campaign.findUnique({ where: { id: campaignId }, select: { ownerId: true } });
    if (!campaign || campaign.ownerId !== userId) throw new ForbiddenException('به این کمپین دسترسی ندارید.');
    return true;
  }
}
