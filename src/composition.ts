import { CreateAdminUserService } from "./auth/AdminUserService";
import { CreateAuthController } from "./auth/AuthController";
import { CreateAuthService } from "./auth/AuthService";
import { CreateInMemoryUserRepository } from "./auth/InMemoryUserRepository";
import { CreatePasswordHasher } from "./auth/PasswordHasher";
import { CreateApp } from "./app";
import type { IApp } from "./contracts";
import { CreateInMemoryEventRepository } from "./repository/InMemoryEventRepository";
import { CreateMemberRsvpsDashboardController } from "./rsvps/MemberRsvpsDashboardController";
import { CreateMemberRsvpsDashboardService } from "./service/MemberRsvpsDashboardService";
import { CreateLoggingService } from "./service/LoggingService";
import type { ILoggingService } from "./service/LoggingService";
import { CreateInMemoryEventRepository } from "./repository/InMemoryEventRepository";
import { CreateInMemoryRSVPRepository } from "./repository/InMemoryRSVPRepository";
import { CreateEventService } from "./service/EventService";
import { CreateRSVPService } from "./service/RSVPService";
import { CreateEventController } from "./controller/EventController";
import { CreateInMemorySavedEventRepository } from "./repository/InMemorySavedEventRepository";
import { SavedEventService } from "./service/SavedEventService";

export function createComposedApp(logger?: ILoggingService): IApp {
    const resolvedLogger = logger ?? CreateLoggingService();

  // Authentication & authorization wiring
  const authUsers = CreateInMemoryUserRepository();
  const eventRepository = CreateInMemoryEventRepository();
  const passwordHasher = CreatePasswordHasher();
  const authService = CreateAuthService(authUsers, passwordHasher);
  const adminUserService = CreateAdminUserService(authUsers, passwordHasher);
  const authController = CreateAuthController(authService, adminUserService, resolvedLogger);
  const memberRsvpsDashboardService = CreateMemberRsvpsDashboardService(
    eventRepository,
    eventRepository,
  );
  const memberRsvpsDashboardController = CreateMemberRsvpsDashboardController(
    memberRsvpsDashboardService,
    resolvedLogger,
  );

  return CreateApp(authController, memberRsvpsDashboardController, resolvedLogger);
}
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
    const rsvpRepository = CreateInMemoryRSVPRepository();
    const eventService = CreateEventService(eventRepository);

    const savedRepo = CreateInMemorySavedEventRepository();
    const savedService = new SavedEventService(savedRepo, eventRepository);

    const eventController = CreateEventController(
        eventService,
        savedService,
        resolvedLogger
    const rsvpService = CreateRSVPService(eventRepository, rsvpRepository);
    const eventController = CreateEventController(
        eventService,
        rsvpService,
        resolvedLogger,
    );

    return CreateApp(
        authController,
        resolvedLogger,
        eventController,
    );
}
