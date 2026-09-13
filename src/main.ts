/**
 * Application entry point scaffolded by TODO-02 §1 (project bootstrap).
 *
 * Sole responsibility: create the Nest app from `AppModule` and start listening.
 * The port is a temporary direct read of `process.env.PORT` (`DEFAULT_PORT`
 * fallback) — `.env` is NOT loaded in this phase. Later sections of
 * `.agent/todos/20260913/20260913-todo-2.md` extend this file: §2 supplies a
 * validated `ConfigService` port read, §3 adds helmet, CORS, morgan, the
 * global `ValidationPipe`, URI versioning and Swagger before `listen()`.
 * Run guide: `docs/app-setup.md`.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

const DEFAULT_PORT = 3001;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT) || DEFAULT_PORT;
  await app.listen(port);
}

void bootstrap();
