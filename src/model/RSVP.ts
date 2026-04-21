export type RSVPStatus = "going" | "waitlisted" | "cancelled";

export interface IRSVP {
    id: number;
    eventId: number;
    userId: string;
    status: "going" | "waitlisted" | "cancelled";
    createdAt: Date; // Determines waitlist order
}

export interface CreateRSVPData {
    eventId: number;
    userId: string;
    status?: "going" | "waitlisted" | "cancelled";
    createdAt?: Date;
}

function normalizeRSVPStatus(status: RSVPStatus | undefined): RSVPStatus {
    const validStatuses: RSVPStatus[] = ["going", "waitlisted", "cancelled"];
    if (status && validStatuses.includes(status)) {
        return status;
    }
    return "going";
}

export class RSVP implements IRSVP {
    id: number;
    eventId: number;
    userId: string;
    status: "going" | "waitlisted" | "cancelled";
    createdAt: Date;

    constructor(id: number, data: CreateRSVPData) {
        this.id = id;
        this.eventId = data.eventId;
        this.userId = data.userId;
        this.status = normalizeRSVPStatus(data.status);
        this.createdAt = data.createdAt ?? new Date();
    }
}

export function createRSVP(id: number, data: CreateRSVPData): IRSVP {
    return new RSVP(id, data);
}

export function toRSVP(model: {
    id: number;
    eventId: number;
    userId: string;
    status: "going" | "waitlisted" | "cancelled";
    createdAt: Date;
}): IRSVP {
    return {
        id: model.id,
        eventId: model.eventId,
        userId: model.userId,
        status: normalizeRSVPStatus(model.status),
        createdAt: model.createdAt
    }
}
