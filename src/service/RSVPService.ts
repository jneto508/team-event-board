import { Err, Ok, Result } from "../lib/result";
import { IEvent } from "../model/Event";
import { RSVPError, EventError, InvalidRSVPData } from "./errors";
import { RSVPStatus } from "../model/RSVP";
import { IAuthenticatedUserSession } from "../session/AppSession";
import { IEventRepository, IRSVPRepository } from "../repository/EventRepository";

export interface ToggleRSVPResult {
    eventId: number;
    userId: string;
    rsvpStatus: RSVPStatus;
    attendeeCount: number;
    waitlistCount: number;
}

export type ToggleRSVPError = EventError | RSVPError;

export interface IRSVPService {
    toggleRSVP(
        eventId: number,
        user: IAuthenticatedUserSession,
    ): Promise<Result<ToggleRSVPResult, ToggleRSVPError>>;
}

export class RSVPService implements IRSVPService {
    constructor(
        private readonly eventRepository: IEventRepository,
        private readonly rsvpRepository: IRSVPRepository,
    ) {}
    
    private validateEligibility(
        event: IEvent,
        user: IAuthenticatedUserSession,
        now: Date,
    ): ToggleRSVPError | null {
        if (user.role !== "user") {
            return InvalidRSVPData("Only members can RSVP to events.");
        }
        if (event.organizerId === user.userId) {
            return InvalidRSVPData("Organizers cannot RSVP to their own events.");
        }
        if (event.status === "cancelled") {
            return InvalidRSVPData("Cancelled events cannot accept RSVPs.");
        }
        if (event.status === "past" || event.endDateTime <= now) {
            return InvalidRSVPData("Past events cannot accept RSVPs.");
        }

        return null;
    }

    private async getAttendanceSnapshot(
        eventId: number,
    ): Promise<Result<{ attendeeCount: number; waitlistCount: number }, RSVPError>> {
        const rsvpsResult = await this.rsvpRepository.listRSVPsByEvent(eventId);
        if (rsvpsResult.ok === false) {
            return Err(rsvpsResult.value);
        }

        const attendeeCount = rsvpsResult.value.filter(
            (rsvp) => rsvp.status === "going",
        ).length;
        const waitlistCount = rsvpsResult.value.filter(
            (rsvp) => rsvp.status === "waitlisted",
        ).length;

        return Ok({ attendeeCount, waitlistCount });
    }

    private async resolveActiveStatus(
        eventId: number,
        capacity: number,
    ): Promise<Result<RSVPStatus, RSVPError>> {
        const snapshotResult = await this.getAttendanceSnapshot(eventId);
        if (snapshotResult.ok === false) {
            return Err(snapshotResult.value);
        }

        if (capacity > 0 && snapshotResult.value.attendeeCount >= capacity) {
            return Ok<RSVPStatus>("waitlisted");
        }

        return Ok<RSVPStatus>("going");
    }

    private async buildToggleResult(
        eventId: number,
        userId: string,
        rsvpStatus: RSVPStatus,
    ): Promise<Result<ToggleRSVPResult, RSVPError>> {
        const snapshotResult = await this.getAttendanceSnapshot(eventId);
        if (snapshotResult.ok === false) {
            return Err(snapshotResult.value);
        }

        return Ok({
            eventId,
            userId,
            rsvpStatus,
            attendeeCount: snapshotResult.value.attendeeCount,
            waitlistCount: snapshotResult.value.waitlistCount,
        });
    }

    async toggleRSVP(
        eventId: number,
        user: IAuthenticatedUserSession,
    ): Promise<Result<ToggleRSVPResult, ToggleRSVPError>> {
        const now = new Date();

        const eventResult = await this.eventRepository.getEventById(eventId);
        if (eventResult.ok === false) {
            return Err(eventResult.value);
        }

        const eligibilityError = this.validateEligibility(
            eventResult.value,
            user,
            now,
        );
        if (eligibilityError) {
            return Err(eligibilityError);
        }

        const existingResult = await this.rsvpRepository.getRSVPByEventAndUser(
            eventId,
            user.userId,
        );

        if (existingResult.ok) {
            const nextStatusResult =
                existingResult.value.status === "cancelled"
                    ? await this.resolveActiveStatus(
                          eventId,
                          eventResult.value.capacity,
                      )
                    : Ok<RSVPStatus>("cancelled");

            if (nextStatusResult.ok === false) {
                return Err(nextStatusResult.value);
            }

            const updatedResult = await this.rsvpRepository.updateRSVPStatus(
                existingResult.value.id,
                nextStatusResult.value,
            );
            if (updatedResult.ok === false) {
                return Err(updatedResult.value);
            }

            return this.buildToggleResult(
                eventId,
                user.userId,
                updatedResult.value.status,
            );
        }

        const initialStatusResult = await this.resolveActiveStatus(
            eventId,
            eventResult.value.capacity,
        );
        if (initialStatusResult.ok === false) {
            return Err(initialStatusResult.value);
        }

        const createdResult = await this.rsvpRepository.createRSVP({
            eventId,
            userId: user.userId,
            status: initialStatusResult.value,
        });
        if (createdResult.ok === false) {
            return Err(createdResult.value);
        }

        return this.buildToggleResult(
            eventId,
            user.userId,
            createdResult.value.status,
        );
    }
}

export function CreateRSVPService(
    eventRepository: IEventRepository,
    rsvpRepository: IRSVPRepository,
): IRSVPService {
    return new RSVPService(eventRepository, rsvpRepository);
}
