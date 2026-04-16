import { CreateAdminUserService } from "./auth/AdminUserService";
import { CreateAuthController } from "./auth/AuthController";
import { CreateAuthService } from "./auth/AuthService";
import { CreateInMemoryUserRepository } from "./auth/InMemoryUserRepository";
import { CreatePasswordHasher } from "./auth/PasswordHasher";
import { CreateApp } from "./app";
import type { IApp } from "./contracts";
import { CreateMemberRsvpsDashboardController } from "./rsvps/MemberRsvpsDashboardController";
import { CreateMemberRsvpsDashboardService } from "./service/MemberRsvpsDashboardService";
import { CreateLoggingService } from "./service/LoggingService";
import type { ILoggingService } from "./service/LoggingService";
import { CreateInMemoryEventRepository } from "./repository/InMemoryEventRepository";
import { CreateInMemorySavedEventRepository } from "./repository/InMemorySavedEventRepository";
import { CreateEventService } from "./service/EventService";
import { CreateRSVPService } from "./service/RSVPService";
import { SavedEventService } from "./service/SavedEventService";
import { CreateEventController } from "./controller/EventController";
import { CreateEventCommentsService } from "./service/EventCommentsService";
import { CreateEventCommentsController } from "./controller/EventCommentsController";

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

    // Repository wiring
    const eventRepository = CreateInMemoryEventRepository();
    const savedEventRepository = CreateInMemorySavedEventRepository();

    // RSVP dashboard wiring
    const memberRsvpsDashboardService = CreateMemberRsvpsDashboardService(
        eventRepository,
        eventRepository,
    );
    const memberRsvpsDashboardController = CreateMemberRsvpsDashboardController(
        memberRsvpsDashboardService,
        resolvedLogger,
    );

    // Event wiring
    const eventService = CreateEventService(eventRepository);
    const rsvpService = CreateRSVPService(eventRepository, eventRepository);
    const savedEventService = new SavedEventService(savedEventRepository, eventRepository);
    const eventController = CreateEventController(
        eventService,
        savedEventService,
        rsvpService,
        resolvedLogger,
    );

    // Event comments wiring
    const eventCommentsService = CreateEventCommentsService(
        eventRepository,
        eventRepository,
        authUsers,
    );
    const eventCommentsController = CreateEventCommentsController(
        eventCommentsService,
        resolvedLogger,
    );

    return CreateApp(
        authController,
        memberRsvpsDashboardController,
        resolvedLogger,
        eventController,
        eventCommentsController,
    );
}
