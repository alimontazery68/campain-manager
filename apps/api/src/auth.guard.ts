import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth.service';
import { IS_PUBLIC_KEY } from './auth.decorator';
@Injectable() export class AuthGuard implements CanActivate { constructor(private reflector:Reflector,private auth:AuthService){} canActivate(ctx:ExecutionContext){ if(this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY,[ctx.getHandler(),ctx.getClass()])) return true; const req=ctx.switchToHttp().getRequest(); const cookie=String(req.headers.cookie||'').split(';').map((v:string)=>v.trim()).find((v:string)=>v.startsWith('campaign_session='))?.split('=')[1]; const token=cookie || req.headers.authorization?.replace(/^Bearer\s+/,''); if(!token) throw new UnauthorizedException(); req.userId=this.auth.verify(token); return true; } }
