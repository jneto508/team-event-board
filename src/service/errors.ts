export type EventError = 
    | {name: "EventNotFound"; message: string}
    | {name: "InvalidEventData"; message: string}
    | {name: "ValidationError"; message: string}
    | {name: "UnexpectedDependencyError"; message: string};

export type RSVPError = 
    | {name: "RSVPNotFound"; message: string}
    | {name: "InvalidRSVPData"; message: string}
    | {name: "ValidationError"; message: string}
    | {name: "UnexpectedDependencyError"; message: string};

export const EventNotFound = (message: string): EventError => ({
    name: "EventNotFound",
    message
});

export const InvalidEventData = (message: string): EventError => ({
    name: "InvalidEventData",
    message
});

export const ValidationError = (message: string): EventError => ({
    name: "ValidationError",
    message
});

export const UnexpectedDependencyError = (message: string): EventError => ({
    name: "UnexpectedDependencyError",
    message
});

export const RSVPUnexpectedDependencyError = (message: string): RSVPError => ({
    name: "UnexpectedDependencyError",
    message
});

export const RSVPNotFound = (message: string): RSVPError => ({
    name: "RSVPNotFound",
    message
});

export const InvalidRSVPData = (message: string): RSVPError => ({
    name: "InvalidRSVPData",
    message
});