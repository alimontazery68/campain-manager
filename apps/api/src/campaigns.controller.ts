import { Body, Controller, Get, Headers, Param, Patch, Post } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { PlanningService } from './ai/planning.service';
import { ContentService } from './ai/content.service';
import { ResultsService } from './results.service';
import { AnalysisService } from './ai/analysis.service';
import { CompletionService } from './completion.service';
import { PreparationService } from './preparation.service';
import { TaskControlsService } from './task-controls.service';
import { LearningService } from './ai/learning.service';
import { ContextService } from './ai/context.service';
@Controller('campaigns') export class CampaignsController {
  constructor(private service:CampaignsService,private planning:PlanningService,private content:ContentService,private results:ResultsService,private analysis:AnalysisService,private completion:CompletionService,private preparation:PreparationService,private controls:TaskControlsService,private learning:LearningService,private context:ContextService){}
  @Post('context') suggest(@Body() body:unknown){return this.context.suggest(body);}
  @Get(':id/history') history(@Param('id') id:string){return this.controls.history(id);}
  @Post('days/:id/tasks') addTask(@Param('id') id:string,@Body() body:unknown){return this.controls.add(id,body);}
  @Patch('tasks/:id') editTask(@Param('id') id:string,@Body() body:unknown){return this.controls.update(id,body);}
  @Patch('days/:id/mission') mission(@Param('id') id:string,@Body() body:unknown){return this.controls.mission(id,body);}
  @Get(':id/learning') learningGet(@Param('id') id:string){return this.learning.get(id);}
  @Post(':id/learning') learningGenerate(@Param('id') id:string){return this.learning.generate(id);}
  @Post(':id/learning/confirm') learningConfirm(@Param('id') id:string,@Body() body:unknown){return this.learning.confirm(id,body);}
  @Get(':id/preparation') preparationGet(@Param('id') id:string){return this.preparation.get(id);}
  @Post(':id/preparation') preparationInitialize(@Param('id') id:string){return this.preparation.initialize(id);}
  @Patch('preparation/:id') preparationUpdate(@Param('id') id:string,@Body() body:unknown){return this.preparation.update(id,body);}
  @Get(':id/completion') completionGet(@Param('id') id:string){return this.completion.get(id);}
  @Post(':id/complete') campaignComplete(@Param('id') id:string,@Body() body:unknown){return this.completion.complete(id,body);}
  @Get(':id/analysis') analysisGet(@Param('id') id:string){return this.analysis.get(id);}
  @Post(':id/analysis') analysisGenerate(@Param('id') id:string){return this.analysis.generate(id);}
  @Post(':id/analysis/decision') analysisDecide(@Param('id') id:string,@Body() body:unknown){return this.analysis.decide(id,body);}
  @Get() list(){return this.service.list();}
  @Get(':id') get(@Param('id') id:string){return this.service.get(id);}
  @Post() create(@Body() body:unknown,@Headers('idempotency-key') key?:string){return this.service.create(body,key);}
  @Get(':id/deletion') deletion(@Param('id') id:string){return this.service.deletionPreview(id);}
  @Post(':id/delete') remove(@Param('id') id:string,@Body() body:unknown){return this.service.remove(id,body);}
  @Post(':id/replan') replan(@Param('id') id:string,@Body() body:unknown){return this.service.replan(id,body);}
  @Post(':id/copy') copy(@Param('id') id:string,@Body() body:unknown){return this.service.copyForEditing(id,body);}
  @Post(':id/plan') plan(@Param('id') id:string){return this.planning.generate(id);}
  @Patch(':id/plan') editPlan(@Param('id') id:string,@Body() body:unknown){return this.planning.edit(id,body);}
  @Patch(':id/setup') setup(@Param('id') id:string,@Body() body:unknown){return this.service.setup(id,body);}
  @Post(':id/approve') approve(@Param('id') id:string){return this.planning.approve(id);}
  @Patch('tasks/:id/complete') complete(@Param('id') id:string){return this.service.completeTask(id);}
  @Post('tasks/:id/content') generateContent(@Param('id') id:string,@Body() body:unknown){return this.content.generate(id,body);}
  @Patch('tasks/:id/content') saveContent(@Param('id') id:string,@Body() body:unknown){return this.content.save(id,body);}
  @Post('days/:id/result') saveResult(@Param('id') id:string,@Body() body:unknown){return this.results.save(id,body);}
}
