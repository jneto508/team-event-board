import path from "node:path";
import express, { Request, RequestHandler, Response } from "express";
import session from "express-session";
import Layouts from "express-ejs-layouts";
import { IAuthController } from "./auth/AuthController";
import { IMemberRsvpsDashboardController } from "./rsvps/MemberRsvpsDashboardController";
import { IEventController } from "./controller/EventController";
import { IEventCommentsController } from "./controller/EventCommentsController";
import { AuthenticationRequired, AuthorizationRequired } from "./auth/errors";
import type { UserRole } from "./auth/User";
import { IApp } from "./contracts";
import {
    getAuthenticatedUser,
    isAuthenticatedSession,
    AppSessionStore,
    recordPageView,
    touchAppSession,
} from "./session/AppSession";
import { ILoggingService } from "./service/LoggingService";

type AsyncRequestHandler = RequestHandler;

function asyncHandler(fn: AsyncRequestHandler) {
    return function wrapped(
        req: Request,
        res: Response,
        next: (value?: unknown) => void,
    ) {
        return Promise.resolve(fn(req, res, next)).catch(next);
    };
}

function sessionStore(req: Request): AppSessionStore {
    return req.session as AppSessionStore;
}

class ExpressApp implements IApp {
    private readonly app: express.Express;

    constructor(
        private readonly authController: IAuthController,
        private readonly memberRsvpsDashboardController: IMemberRsvpsDashboardController,
        private readonly logger: ILoggingService,
        private readonly eventController: IEventController,
        private readonly eventCommentsController: IEventCommentsController,
    ) {
        this.app = express();
        this.registerMiddleware();
        this.registerTemplating();
        this.registerRoutes();
    }

    private registerMiddleware(): void {
        // Serve static files from src/static (create this directory to add your own assets)
        this.app.use(express.static(path.join(process.cwd(), "src/static")));
        this.app.use(
            session({
                name: "app.sid",
                secret:
                    process.env.SESSION_SECRET ?? "project-starter-demo-secret",
                resave: false,
                saveUninitialized: false,
                cookie: {
                    httpOnly: true,
                    sameSite: "lax",
                },
            }),
        );
        this.app.use(Layouts);
        this.app.use(express.urlencoded({ extended: true }));
        this.app.use(express.json());
    }

    private registerTemplating(): void {
        this.app.set("view engine", "ejs");
        this.app.set("views", path.join(process.cwd(), "src/views"));
        this.app.set("layout", "layouts/base");
    }

    private isHtmxRequest(req: Request): boolean {
        return req.get("HX-Request") === "true";
    }

    /**
     * Middleware helper: returns true if the request is from an authenticated user.
     * If the user is not authenticated, it handles the response (redirect or 401).
     */
    private requireAuthenticated(req: Request, res: Response): boolean {
        const store = sessionStore(req);
        touchAppSession(store);

        if (getAuthenticatedUser(store)) {
            return true;
        }

        this.logger.warn(
            "Blocked unauthenticated request to a protected route",
        );
        if (this.isHtmxRequest(req) || req.method !== "GET") {
            res.status(401).render("partials/error", {
                message: AuthenticationRequired("Please log in to continue.")
                    .message,
                layout: false,
            });
            return false;
        }

        res.redirect("/login");
        return false;
    }

    /**
     * Middleware helper: returns true if the authenticated user has one of the
     * allowed roles. Calls requireAuthenticated first, so unauthenticated
     * requests are handled automatically.
     */
    private requireRole(
        req: Request,
        res: Response,
        allowedRoles: UserRole[],
        message: string,
    ): boolean {
        if (!this.requireAuthenticated(req, res)) {
            return false;
        }

        const currentUser = getAuthenticatedUser(sessionStore(req));
        if (currentUser && allowedRoles.includes(currentUser.role)) {
            return true;
        }

        this.logger.warn(
            `Blocked unauthorized request for role ${currentUser?.role ?? "unknown"}`,
        );
        res.status(403).render("partials/error", {
            message: AuthorizationRequired(message).message,
            layout: false,
        });
        return false;
    }

    private registerRoutes(): void {
        // ── Public routes ────────────────────────────────────────────────

        this.app.get(
            "/",
            asyncHandler(async (req, res) => {
                this.logger.info("GET /");
                const store = sessionStore(req);
                res.redirect(
                    isAuthenticatedSession(store) ? "/home" : "/login",
                );
            }),
        );

        this.app.get(
            "/events/search",
            asyncHandler(async (req, res) => {
              if (!this.requireAuthenticated(req, res)) {
                return;
              }
          
              const query =
                typeof req.query.q === "string" ? req.query.q : "";
          
              const browserSession = recordPageView(sessionStore(req));
          
              await this.eventController.searchEvents(
                res,
                query,
                browserSession
              );
            }),
          );

        this.app.get(
            "/login",
            asyncHandler(async (req, res) => {
                const store = sessionStore(req);
                const browserSession = recordPageView(store);

                if (getAuthenticatedUser(store)) {
                    res.redirect("/home");
                    return;
                }

                await this.authController.showLogin(res, browserSession);
            }),
        );

        this.app.post(
            "/login",
            asyncHandler(async (req, res) => {
                const email =
                    typeof req.body.email === "string" ? req.body.email : "";
                const password =
                    typeof req.body.password === "string"
                        ? req.body.password
                        : "";
                await this.authController.loginFromForm(
                    res,
                    email,
                    password,
                    sessionStore(req),
                );
            }),
        );

        this.app.post(
            "/logout",
            asyncHandler(async (req, res) => {
                await this.authController.logoutFromForm(
                    res,
                    sessionStore(req),
                );
            }),
        );

        // ── Admin routes ─────────────────────────────────────────────────

        this.app.get(
            "/admin/users",
            asyncHandler(async (req, res) => {
                if (
                    !this.requireRole(
                        req,
                        res,
                        ["admin"],
                        "Only Admin can manage users.",
                    )
                ) {
                    return;
                }

                const browserSession = recordPageView(sessionStore(req));
                await this.authController.showAdminUsers(res, browserSession);
            }),
        );

        this.app.post(
            "/admin/users",
            asyncHandler(async (req, res) => {
                if (
                    !this.requireRole(
                        req,
                        res,
                        ["admin"],
                        "Only Admin can manage users.",
                    )
                ) {
                    return;
                }

                const roleValue =
                    typeof req.body.role === "string" ? req.body.role : "user";
                const role: UserRole =
                    roleValue === "admin" ||
                    roleValue === "staff" ||
                    roleValue === "user"
                        ? roleValue
                        : "user";

                await this.authController.createUserFromForm(
                    res,
                    {
                        email:
                            typeof req.body.email === "string"
                                ? req.body.email
                                : "",
                        displayName:
                            typeof req.body.displayName === "string"
                                ? req.body.displayName
                                : "",
                        password:
                            typeof req.body.password === "string"
                                ? req.body.password
                                : "",
                        role,
                    },
                    touchAppSession(sessionStore(req)),
                );
            }),
        );

        this.app.post(
            "/admin/users/:id/delete",
            asyncHandler(async (req, res) => {
                if (
                    !this.requireRole(
                        req,
                        res,
                        ["admin"],
                        "Only Admin can manage users.",
                    )
                ) {
                    return;
                }

                const session = touchAppSession(sessionStore(req));
                const currentUser = getAuthenticatedUser(sessionStore(req));
                if (!currentUser) {
                    res.status(401).render("partials/error", {
                        message: AuthenticationRequired(
                            "Please log in to continue.",
                        ).message,
                        layout: false,
                    });
                    return;
                }

                await this.authController.deleteUserFromForm(
                    res,
                    typeof req.params.id === "string" ? req.params.id : "",
                    currentUser.userId,
                    session,
                );
            }),
        );

        // ── Authenticated home page ──────────────────────────────────────

        this.app.get(
            "/home",
            asyncHandler(async (req, res) => {
                if (!this.requireAuthenticated(req, res)) {
                    return;
                }

                const browserSession = recordPageView(sessionStore(req));
                this.logger.info(
                    `GET /home for ${browserSession.browserLabel}`,
                );
                await this.eventCommentsController.showHome(res, browserSession);
            }),
        );

        // ── RSVP routes ──────────────────────────────────────────────────

        this.app.get(
            "/my-rsvps",
            asyncHandler(async (req, res) => {
                if (!this.requireRole(req, res, ["user"], "Only members can view My RSVPs.")) {
                    return;
                }

                const browserSession = recordPageView(sessionStore(req));
                const currentUser = getAuthenticatedUser(sessionStore(req));
                if (!currentUser) {
                    res.status(401).render("partials/error", {
                        message: AuthenticationRequired("Please log in to continue.").message,
                        layout: false,
                    });
                    return;
                }

                this.logger.info(`GET /my-rsvps for ${currentUser.email}`);
                await this.memberRsvpsDashboardController.showDashboard(
                    res,
                    currentUser.userId,
                    browserSession,
                );
            }),
        );

        this.app.post(
            "/my-rsvps/:eventId/cancel",
            asyncHandler(async (req, res) => {
                if (!this.requireRole(req, res, ["user"], "Only members can manage My RSVPs.")) {
                    return;
                }

                const currentUser = getAuthenticatedUser(sessionStore(req));
                if (!currentUser) {
                    res.status(401).render("partials/error", {
                        message: AuthenticationRequired("Please log in to continue.").message,
                        layout: false,
                    });
                    return;
                }

                const eventId = Number.parseInt(
                    typeof req.params.eventId === "string" ? req.params.eventId : "",
                    10,
                );

                await this.memberRsvpsDashboardController.cancelRsvp(
                    res,
                    currentUser.userId,
                    eventId,
                    touchAppSession(sessionStore(req)),
                );
            }),
        );

        // ── Event routes ─────────────────────────────────────────────────

        this.app.get(
            "/events/new",
            asyncHandler(async (req, res) => {
                if (!this.requireRole(req, res, ["staff", "admin"], "Only organizers can create events.")) {
                    return;
                }

                const browserSession = recordPageView(sessionStore(req));
                this.logger.info(
                    `GET /events/new for ${browserSession.browserLabel}`,
                );
                await this.eventController.showNewEventForm(
                    res,
                    browserSession,
                );
            }),
        );

        this.app.get(
            "/events/archive",
            asyncHandler(async (req, res) => {
                if (!this.requireAuthenticated(req, res)) {
                    return;
                }

                await this.eventController.showArchivePage(
                    res,
                    recordPageView(sessionStore(req)),
                    typeof req.query.category === "string"
                        ? req.query.category
                        : undefined,
                    this.isHtmxRequest(req),
                );
            }),
        );

        this.app.get(
            "/events/:eventId",
            asyncHandler(async (req, res) => {
                if (!this.requireAuthenticated(req, res)) {
                    return;
                }

                const browserSession = recordPageView(sessionStore(req));
                const currentUser = getAuthenticatedUser(sessionStore(req));
                if (!currentUser) {
                    res.status(401).render("partials/error", {
                        message: AuthenticationRequired(
                            "Please log in to continue.",
                        ).message,
                        layout: false,
                    });
                    return;
                }

                const eventId = Number.parseInt(
                    typeof req.params.eventId === "string" ? req.params.eventId : "",
                    10,
                );

                if (Number.isNaN(eventId)) {
                    res.status(400).render("partials/error", {
                        message: "Invalid event ID.",
                        layout: false,
                    });
                    return;
                }

                await this.eventController.showEventDetail(
                    res,
                    eventId,
                    {
                        userId: currentUser.userId,
                        role: currentUser.role,
                    },
                    browserSession,
                );
            }),
        );

        this.app.get(
            "/events/:eventId/attendees",
            asyncHandler(async (req, res) => {
                if (!this.requireAuthenticated(req, res)) {
                    return;
                }

                const browserSession = recordPageView(sessionStore(req));
                const currentUser = getAuthenticatedUser(sessionStore(req));
                if (!currentUser) {
                    res.status(401).render("partials/error", {
                        message: AuthenticationRequired(
                            "Please log in to continue.",
                        ).message,
                        layout: false,
                    });
                    return;
                }

                const eventId = Number.parseInt(
                    typeof req.params.eventId === "string" ? req.params.eventId : "",
                    10,
                );

                if (Number.isNaN(eventId)) {
                    res.status(400).render("partials/error", {
                        message: "Invalid event ID.",
                        layout: false,
                    });
                    return;
                }

                await this.eventController.showAttendeeList(
                    res,
                    eventId,
                    {
                        userId: currentUser.userId,
                        role: currentUser.role,
                    },
                    browserSession,
                );
            }),
        );

        this.app.post(
            "/events",
            asyncHandler(async (req, res) => {
                if (!this.requireRole(req, res, ["staff", "admin"], "Only organizers can create events.")) {
                    return;
                }

                const store = sessionStore(req);
                const organizerId = getAuthenticatedUser(store)!.userId;

                await this.eventController.createEventFromForm(
                    res,
                    {
                        title:
                            typeof req.body.title === "string"
                                ? req.body.title.trim()
                                : "",
                        description:
                            typeof req.body.description === "string"
                                ? req.body.description.trim()
                                : "",
                        location:
                            typeof req.body.location === "string"
                                ? req.body.location.trim()
                                : "",
                        category:
                            typeof req.body.category === "string"
                                ? req.body.category.trim()
                                : "",
                        capacity:
                            typeof req.body.capacity === "string"
                                ? req.body.capacity.trim()
                                : "",
                        startDateTime:
                            typeof req.body.startDateTime === "string"
                                ? req.body.startDateTime
                                : "",
                        endDateTime:
                            typeof req.body.endDateTime === "string"
                                ? req.body.endDateTime
                                : "",
                    },
                    organizerId,
                    touchAppSession(store),
                );
            }),
        );

        this.app.post(
            "/events/:eventId/comments",
            asyncHandler(async (req, res) => {
                if (!this.requireAuthenticated(req, res)) {
                    return;
                }

                const currentUser = getAuthenticatedUser(sessionStore(req));
                if (!currentUser) {
                    res.status(401).render("partials/error", {
                        message: AuthenticationRequired(
                            "Please log in to continue.",
                        ).message,
                        layout: false,
                    });
                    return;
                }

                await this.eventCommentsController.createCommentFromForm(
                    res,
                    {
                        eventId:
                            typeof req.params.eventId === "string"
                                ? req.params.eventId
                                : "",
                        userId: currentUser.userId,
                        content:
                            typeof req.body.content === "string"
                                ? req.body.content
                                : "",
                        htmx: this.isHtmxRequest(req),
                    },
                    touchAppSession(sessionStore(req)),
                );
            }),
        );

        this.app.post(
            "/events/:eventId/comments/:commentId/delete",
            asyncHandler(async (req, res) => {
                if (!this.requireAuthenticated(req, res)) {
                    return;
                }

                const currentUser = getAuthenticatedUser(sessionStore(req));
                if (!currentUser) {
                    res.status(401).render("partials/error", {
                        message: AuthenticationRequired(
                            "Please log in to continue.",
                        ).message,
                        layout: false,
                    });
                    return;
                }

                await this.eventCommentsController.deleteCommentFromForm(
                    res,
                    {
                        eventId:
                            typeof req.params.eventId === "string"
                                ? req.params.eventId
                                : "",
                        commentId:
                            typeof req.params.commentId === "string"
                                ? req.params.commentId
                                : "",
                        actorUserId: currentUser.userId,
                        htmx: this.isHtmxRequest(req),
                    },
                    touchAppSession(sessionStore(req)),
                );
            }),
        );

        this.app.post(
            "/events/:eventId/save",
            asyncHandler(async (req, res) => {
                if (!this.requireAuthenticated(req, res)) {
                    return;
                }

                const eventId = Number(req.params.eventId);
                const user = getAuthenticatedUser(sessionStore(req));

                if (!user) {
                    res.status(401).render("partials/error", {
                        message: "User not authenticated.",
                        layout: false,
                    });
                    return;
                }

                await this.eventController.toggleSave(
                    res,
                    eventId,
                    user.userId,
                    user.role,
                );
            }),
        );

        this.app.get(
            "/users/:userId/saved-events",
            asyncHandler(async (req, res) => {
                if (!this.requireAuthenticated(req, res)) {
                    return;
                }

                const userId =
                    typeof req.params.userId === "string" ? req.params.userId : "";
                const browserSession = recordPageView(sessionStore(req));

                await this.eventController.showSavedEvents(
                    res,
                    userId,
                    browserSession,
                );
            }),
        );

        this.app.get(
            "/events/:id/edit",
            asyncHandler(async (req, res) => {
                if (!this.requireAuthenticated(req, res)) {
                    return;
                }

                const eventId = parseInt(String(req.params.id), 10);
                if (isNaN(eventId)) {
                    res.status(400).render("partials/error", {
                        message: "Invalid event ID.",
                        layout: false,
                    });
                    return;
                }

                const store = sessionStore(req);
                const user = getAuthenticatedUser(store)!;
                const browserSession = recordPageView(store);

                await this.eventController.showEditEventForm(
                    res,
                    eventId,
                    user.userId,
                    user.role,
                    browserSession,
                );
            }),
        );

        this.app.post(
            "/events/:id",
            asyncHandler(async (req, res) => {
                if (!this.requireAuthenticated(req, res)) {
                    return;
                }

                const eventId = parseInt(String(req.params.id), 10);
                if (isNaN(eventId)) {
                    res.status(400).render("partials/error", {
                        message: "Invalid event ID.",
                        layout: false,
                    });
                    return;
                }

                const store = sessionStore(req);
                const user = getAuthenticatedUser(store)!;

                await this.eventController.updateEventFromForm(
                    res,
                    eventId,
                    {
                        title:
                            typeof req.body.title === "string"
                                ? req.body.title.trim()
                                : "",
                        description:
                            typeof req.body.description === "string"
                                ? req.body.description.trim()
                                : "",
                        location:
                            typeof req.body.location === "string"
                                ? req.body.location.trim()
                                : "",
                        category:
                            typeof req.body.category === "string"
                                ? req.body.category.trim()
                                : "",
                        capacity:
                            typeof req.body.capacity === "string"
                                ? req.body.capacity.trim()
                                : "",
                        startDateTime:
                            typeof req.body.startDateTime === "string"
                                ? req.body.startDateTime
                                : "",
                        endDateTime:
                            typeof req.body.endDateTime === "string"
                                ? req.body.endDateTime
                                : "",
                    },
                    user.userId,
                    user.role,
                    touchAppSession(store),
                );
            }),
        );

        this.app.post(
            "/events/:id/rsvp-toggle",
            asyncHandler(async (req, res) => {
                const eventId = Number(req.params.id);
                if (!Number.isInteger(eventId) || eventId <= 0) {
                    res.status(400).json({
                        error: "A valid event id is required.",
                    });
                    return;
                }

                if (
                    this.isHtmxRequest(req) &&
                    req.get("HX-Target") === "rsvp-dashboard-sections"
                ) {
                    if (!this.requireRole(req, res, ["user"], "Only members can manage My RSVPs.")) {
                        return;
                    }

                    const currentUser = getAuthenticatedUser(sessionStore(req));
                    if (!currentUser) {
                        res.status(401).render("partials/error", {
                            message: AuthenticationRequired("Please log in to continue.").message,
                            layout: false,
                        });
                        return;
                    }

                    await this.memberRsvpsDashboardController.toggleRsvpInline(
                        res,
                        currentUser,
                        eventId,
                        touchAppSession(sessionStore(req)),
                    );
                    return;
                }

                if (
                    this.isHtmxRequest(req) &&
                    typeof req.get("HX-Target") === "string" &&
                    req.get("HX-Target")!.startsWith("rsvp-toggle-")
                ) {
                    if (!this.requireAuthenticated(req, res)) {
                        return;
                    }

                    const currentUser = getAuthenticatedUser(sessionStore(req));
                    if (!currentUser) {
                        res.status(401).render("partials/error", {
                            message: AuthenticationRequired("Please log in to continue.").message,
                            layout: false,
                        });
                        return;
                    }

                    await this.eventController.toggleRSVPInline(
                        res,
                        eventId,
                        currentUser,
                    );
                    return;
                }

                if (!this.requireAuthenticated(req, res)) {
                    return;
                }

                const currentUser = getAuthenticatedUser(sessionStore(req));
                if (!currentUser) {
                    res.status(401).json({
                        error: "Please log in to continue.",
                    });
                    return;
                }

                await this.eventController.toggleRSVP(
                    res,
                    eventId,
                    currentUser,
                );
            }),
        );

        // ── Error handler ────────────────────────────────────────────────

        this.app.use(
            (
                err: unknown,
                _req: Request,
                res: Response,
                _next: (value?: unknown) => void,
            ) => {
                const message =
                    err instanceof Error
                        ? err.message
                        : "Unexpected server error.";
                this.logger.error(message);
                res.status(500).render("partials/error", {
                    message: "Unexpected server error.",
                    layout: false,
                });
            },
        );
    }

    getExpressApp(): express.Express {
        return this.app;
    }
}

export function CreateApp(
    authController: IAuthController,
    memberRsvpsDashboardController: IMemberRsvpsDashboardController,
    logger: ILoggingService,
    eventController: IEventController,
    eventCommentsController: IEventCommentsController,
): IApp {
    return new ExpressApp(
        authController,
        memberRsvpsDashboardController,
        logger,
        eventController,
        eventCommentsController,
    );
}
