import { CreateAdminUserService } from "./auth/AdminUserService";
import { CreateAuthController } from "./auth/AuthController";
import { CreateAuthService } from "./auth/AuthService";
import { CreateInMemoryUserRepository } from "./auth/InMemoryUserRepository";
import { CreatePasswordHasher } from "./auth/PasswordHasher";
import { CreateApp } from "./app";
import type { IApp } from "./contracts";
import { CreateLoggingService } from "./service/LoggingService";
import type { ILoggingService } from "./service/LoggingService";
import { CreateInMemoryEventRepository } from "./repository/InMemoryEventRepository";
import { CreateEventService } from "./service/EventService";
import { CreateEventController } from "./controller/EventController";
import { CreateInMemorySavedEventRepository } from "./repository/InMemorySavedEventRepository";
import { SavedEventService } from "./service/SavedEventService";

export function createComposedApp(logger?: ILoggingService): IApp {
    const resolvedLogger = logger ?? CreateLoggingService();

    // Authentication & authorization wiring
    const authUsers = CreateInMemoryUserRepository();
    const passwordHasher = CreatePasswordHasher();
    const authService = CreateAuthService(authUsers, passwordHasher);
    const adminUserService = CreateAdminUserService(authUsers, passwordHasher);
    const authController = CreateAuthController(
        authService,
        adminUserService,
        resolvedLogger,
    );

    // Event wiring
    const eventRepository = CreateInMemoryEventRepository();
    const eventService = CreateEventService(eventRepository);

    const savedRepo = CreateInMemorySavedEventRepository();
    const savedService = new SavedEventService(savedRepo, eventRepository);

    const eventController = CreateEventController(
        eventService,
        savedService,
        resolvedLogger
    );

    return CreateApp(
        authController,
        resolvedLogger,
        eventController,
    );
}