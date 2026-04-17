import { Err, Ok, Result } from "../lib/result";
import { createRSVP, IRSVP, RSVPStatus } from "../model/RSVP";
import {
    CreateRSVPInput,
    IRSVPRepository,
    RSVPFilterStatus,
} from "./EventRepository";
import {
    InvalidRSVPData,
    RSVPError,
    RSVPNotFound,
    UnexpectedDependencyError,
} from "../service/errors";

class InMemoryRSVPRepository implements IRSVPRepository {
    private rsvps: IRSVP[] = [];
    private nextRsvpId = 1;

    private findRSVP(id: number): IRSVP | undefined {
        return this.rsvps.find((candidate) => candidate.id === id);
    }

    private findRSVPByEventAndUser(
        eventId: number,
        userId: string,
    ): IRSVP | undefined {
        return this.rsvps.find(
            (candidate) =>
                candidate.eventId === eventId && candidate.userId === userId,
        );
    }

    async createRSVP(
        data: CreateRSVPInput,
    ): Promise<Result<IRSVP, RSVPError>> {
        try {
            const existing = this.findRSVPByEventAndUser(
                data.eventId,
                data.userId,
            );
            if (existing) {
                return Err(
                    InvalidRSVPData(
                        "An RSVP for this user and event already exists.",
                    ),
                );
            }

            const rsvp = createRSVP(this.nextRsvpId++, data);
            this.rsvps.push(rsvp);
            return Ok(rsvp);
        } catch {
            return Err(UnexpectedDependencyError("Failed to create RSVP."));
        }
    }

    async getRSVPById(id: number): Promise<Result<IRSVP, RSVPError>> {
        try {
            const rsvp = this.findRSVP(id);
            if (!rsvp) {
                return Err(RSVPNotFound(`RSVP with id ${id} not found.`));
            }
            return Ok(rsvp);
        } catch {
            return Err(
                UnexpectedDependencyError("Failed to retrieve RSVP."),
            );
        }
    }

    async getRSVPByEventAndUser(
        eventId: number,
        userId: string,
    ): Promise<Result<IRSVP, RSVPError>> {
        try {
            const rsvp = this.findRSVPByEventAndUser(eventId, userId);
            if (!rsvp) {
                return Err(
                    RSVPNotFound(
                        `RSVP for user ${userId} and event ${eventId} not found.`,
                    ),
                );
            }
            return Ok(rsvp);
        } catch {
            return Err(
                UnexpectedDependencyError("Failed to retrieve RSVP."),
            );
        }
    }

    async listAllRSVPs(): Promise<Result<IRSVP[], RSVPError>> {
        try {
            return Ok([...this.rsvps]);
        } catch {
            return Err(UnexpectedDependencyError("Failed to list RSVPs."));
        }
    }

    async listRSVPsByEvent(
        eventId: number,
        filterStatus: RSVPFilterStatus = "all",
    ): Promise<Result<IRSVP[], RSVPError>> {
        try {
            const filtered = this.rsvps.filter((rsvp) => rsvp.eventId === eventId);

            if (filterStatus === "all") {
                return Ok([...filtered]);
            }

            return Ok(filtered.filter((rsvp) => rsvp.status === filterStatus));
        } catch {
            return Err(
                UnexpectedDependencyError("Failed to list event RSVPs."),
            );
        }
    }

    async listRSVPsByUser(
        userId: string,
        filterStatus: RSVPFilterStatus = "all",
    ): Promise<Result<IRSVP[], RSVPError>> {
        try {
            const filtered = this.rsvps.filter((rsvp) => rsvp.userId === userId);

            if (filterStatus === "all") {
                return Ok([...filtered]);
            }

            return Ok(filtered.filter((rsvp) => rsvp.status === filterStatus));
        } catch {
            return Err(
                UnexpectedDependencyError("Failed to list user RSVPs."),
            );
        }
    }

    async updateRSVPStatus(
        id: number,
        status: RSVPStatus,
    ): Promise<Result<IRSVP, RSVPError>> {
        try {
            const rsvp = this.findRSVP(id);
            if (!rsvp) {
                return Err(RSVPNotFound(`RSVP with id ${id} not found.`));
            }

            rsvp.status = status;
            return Ok(rsvp);
        } catch {
            return Err(UnexpectedDependencyError("Failed to update RSVP."));
        }
    }
}

export function CreateInMemoryRSVPRepository(): IRSVPRepository {
    return new InMemoryRSVPRepository();
}
