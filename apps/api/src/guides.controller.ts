import {Controller,Get} from '@nestjs/common';
import {Public} from './auth.decorator';
import {publicGuides} from './campaign-guides';
@Public()
@Controller('guides')
export class GuidesController {@Get() list(){return publicGuides();}}
