import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AiService } from './ai/ai.service';
import { IntegrationsService } from './integrations/integrations.service';
import { AgentController } from './agent/agent.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
  ],
  controllers: [AppController, AgentController],
  providers: [AppService, AiService, IntegrationsService],
})
export class AppModule {}
