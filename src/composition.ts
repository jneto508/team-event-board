import { PrismaClient } from "@prisma/client";
import { PrismaBetterSQLite3 } from "@prisma/adapter-better-sqlite3";
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
import { CreatePrismaEventRepository } from "./repository/PrismaEventRepository";
import { CreateEventService } from "./service/EventService";
import { CreateRSVPService } from "./service/RSVPService";
import { SavedEventService } from "./service/SavedEventService";
import { CreateEventController } from "./controller/EventController";
import { CreateEventCommentsService } from "./service/EventCommentsService";
import { CreateEventCommentsController } from "./controller/EventCommentsController";
import { CreateAttendeeListService } from "./service/AttendeeListService";

export function createComposedApp(mode: "memory" | "prisma", logger?: ILoggingService): IApp {
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
    const prismaRepository = 
        CreatePrismaEventRepository(
            new PrismaClient({
            adapter: new PrismaBetterSQLite3({
                url: process.env.DATABASE_URL ?? "file:./prisma/prisma/dev.db",
            }),
        }),
    );

    const eventRepository =
    mode === "prisma"
        ? prismaRepository
        : CreateInMemoryEventRepository();

    const savedEventRepository =
    mode === "prisma"
        ? prismaRepository
        : CreateInMemorySavedEventRepository();


    // Event wiring
    const eventService = CreateEventService(eventRepository);
    const rsvpService = CreateRSVPService(eventRepository, eventRepository);
    const savedEventService = new SavedEventService(savedEventRepository, eventRepository);
    const eventCommentsService = CreateEventCommentsService(
        eventRepository,
        eventRepository,
        eventRepository,
        authUsers,
    );

    // RSVP dashboard wiring
    const memberRsvpsDashboardService = CreateMemberRsvpsDashboardService(
        eventRepository,
        eventRepository,
    );
    const memberRsvpsDashboardController = CreateMemberRsvpsDashboardController(
        memberRsvpsDashboardService,
        rsvpService,
        resolvedLogger,
    );

    const attendeeListService = CreateAttendeeListService(
        eventRepository,
        eventRepository,
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
