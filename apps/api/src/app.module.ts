import { Module, Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { PlanningService } from './ai/planning.service';
import { DeepSeekProvider } from './ai/deepseek';
import { AI_PROVIDER } from './ai/provider';
import { ContentService } from './ai/content.service';
import { ResultsService } from './results.service';
import { AnalysisService } from './ai/analysis.service';
import { CompletionService } from './completion.service';
import { PreparationService } from './preparation.service';
import { TaskControlsService } from './task-controls.service';
import { LearningService } from './ai/learning.service';
import { ContextService } from './ai/context.service';
@Controller('health') class HealthController { @Get() check(){ return { status:'ok', service:'campaign-manager-api' }; } }
@Module({controllers:[HealthController,CampaignsController],providers:[PrismaService,CampaignsService,PlanningService,ContentService,ResultsService,AnalysisService,CompletionService,PreparationService,TaskControlsService,LearningService,ContextService,{provide:AI_PROVIDER,useClass:DeepSeekProvider}]}) export class AppModule {}
