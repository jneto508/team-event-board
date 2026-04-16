import type { Response } from "express";
import type { IAppBrowserSession } from "../session/AppSession";
import type { ILoggingService } from "../service/LoggingService";
import type {
  IMemberRsvpsDashboardService,
  MemberRsvpsDashboard,
} from "../service/MemberRsvpsDashboardService";

export interface IMemberRsvpsDashboardController {
  showDashboard(
    res: Response,
    userId: string,
    session: IAppBrowserSession,
  ): Promise<void>;
  cancelRsvp(
    res: Response,
    userId: string,
    eventId: number,
    session: IAppBrowserSession,
  ): Promise<void>;
}

class MemberRsvpsDashboardController implements IMemberRsvpsDashboardController {
  constructor(
    private readonly service: IMemberRsvpsDashboardService,
    private readonly logger: ILoggingService,
  ) {}

  private mapErrorStatus(error: { name: string }): number {
    if (error.name === "ValidationError") return 400;
    if (error.name === "RSVPNotFound") return 404;
    if (error.name === "InvalidRSVPState") return 409;
    return 500;
  }

  private async renderDashboard(
    res: Response,
    session: IAppBrowserSession,
    dashboard: MemberRsvpsDashboard,
    pageError: string | null = null,
  ): Promise<void> {
    res.render("rsvps/dashboard", {
      pageError,
      session,
      upcoming: dashboard.upcoming,
      history: dashboard.history,
    });
  }

  async showDashboard(
    res: Response,
    userId: string,
    session: IAppBrowserSession,
  ): Promise<void> {
    const result = await this.service.getMemberRsvpsDashboard(userId);

    if (result.ok === false) {
      this.logger.error(`Unable to load RSVP dashboard: ${result.value.message}`);
      res.status(500);
      await this.renderDashboard(
        res,
        session,
        { upcoming: [], history: [] },
        result.value.message,
      );
      return;
    }

    await this.renderDashboard(res, session, result.value);
  }

  async cancelRsvp(
    res: Response,
    userId: string,
    eventId: number,
    session: IAppBrowserSession,
  ): Promise<void> {
    const cancelResult = await this.service.cancelUpcomingRsvp(userId, eventId);
    if (cancelResult.ok === false) {
      const status = this.mapErrorStatus(cancelResult.value);
      if (status >= 500) {
        this.logger.error(`Unable to cancel RSVP: ${cancelResult.value.message}`);
      } else {
        this.logger.warn(`Cancel RSVP blocked: ${cancelResult.value.message}`);
      }

      const dashboardResult = await this.service.getMemberRsvpsDashboard(userId);
      res.status(status);
      await this.renderDashboard(
        res,
        session,
        dashboardResult.ok ? dashboardResult.value : { upcoming: [], history: [] },
        cancelResult.value.message,
      );
      return;
    }

    this.logger.info(`Cancelled RSVP for user ${userId} on event ${eventId}`);
    res.redirect("/my-rsvps");
  }
}

export function CreateMemberRsvpsDashboardController(
  service: IMemberRsvpsDashboardService,
  logger: ILoggingService,
): IMemberRsvpsDashboardController {
  return new MemberRsvpsDashboardController(service, logger);
}
