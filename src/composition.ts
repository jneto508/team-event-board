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
import { CreateAttendeeListService } from "./service/AttendeeListService";
import { CreatePrismaEventRepository } from "./repository/PrismaEventRepository";

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
    const eventRepository = CreatePrismaEventRepository();
    const legacyRepository = CreateInMemoryEventRepository();
    const savedEventRepository = CreateInMemorySavedEventRepository();
   

    // Event wiring
    const eventService = CreateEventService(eventRepository);
    const rsvpService = CreateRSVPService(legacyRepository, legacyRepository);
    const savedEventService = new SavedEventService(savedEventRepository, eventRepository);
    const eventCommentsService = CreateEventCommentsService(
        eventRepository,
        legacyRepository,
        legacyRepository,
        authUsers,
    );

    // RSVP dashboard wiring
    const memberRsvpsDashboardService = CreateMemberRsvpsDashboardService(
        eventRepository,
        legacyRepository,
    );
    const memberRsvpsDashboardController = CreateMemberRsvpsDashboardController(
        memberRsvpsDashboardService,
        rsvpService,
        resolvedLogger,
    );

    const attendeeListService = CreateAttendeeListService(
        eventRepository,
        legacyRepository,
        authUsers,
    );
    const eventController = CreateEventController(
        eventService,
        savedEventService,
        rsvpService,
        attendeeListService,
        eventCommentsService,
        resolvedLogger,
    );

    // Event comments wiring
    const eventCommentsController = CreateEventCommentsController(
        eventCommentsService,
        savedEventService,
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
