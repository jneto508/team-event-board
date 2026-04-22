# CONTRACTS.md

# Interface Contract
Defines shared service-layer interfaces, expected inputs/outputs, and named errors for feature integration.

---

# Feature 1 — Event Creation

## EventService.createEvent
Creates a new draft event for the acting organizer.

**Input**
```ts
createEvent(input: {
  title: string
  description: string
  location: string
  category: string
  capacity?: number
  startDatetime: Date
  endDatetime: Date
  organizerId: string
}): Promise<Result<Event, InvalidInputError>>

Success Output

{
  ok: true,
  value: Event
}

Errors
	•	InvalidInputError
	•	Missing required fields
	•	Invalid capacity
	•	End before start
	•	Invalid date/time format

⸻

EventService.validateEventInput

Validates event creation/edit input.

Input

validateEventInput(input: EventInput): boolean

Output

true | false


⸻

Feature 2 — Event Detail Page

EventService.getEventById

Returns event details if visible to requesting user.

Input

getEventById(
  eventId: string,
  actor: {
    userId: string
    role: UserRole
  }
): Promise<Result<Event, EventNotFoundError>>

Success Output

{
  ok: true,
  value: Event
}

Errors
	•	EventNotFoundError
	•	Event does not exist
	•	Event is draft and actor is not organizer/admin

⸻

Feature 3 — Event Editing

EventService.updateEvent

Updates an existing event.

Input

updateEvent(
  eventId: string,
  actor: {
    userId: string
    role: UserRole
  },
  updates: {
    title: string
    description: string
    location: string
    category: string
    capacity?: number
    startDatetime: Date
    endDatetime: Date
  }
): Promise<Result<Event, EventNotFoundError | UnauthorizedError | InvalidInputError | InvalidEventStateError>>

Success Output

{
  ok: true,
  value: Event
}

Errors
	•	EventNotFoundError
	•	UnauthorizedError
	•	InvalidInputError
	•	InvalidEventStateError

⸻

Feature 4 — RSVP Toggle

EventService.toggleRSVP

Toggles RSVP status for a user on an event.

Input

toggleRSVP(
  eventId: string,
  userId: string
): Promise<Result<RSVP, EventNotFoundError | InvalidEventDataError>>

Success Output

{
  ok: true,
  value: RSVP
}

Behavior
	•	New RSVP:
	•	going if capacity available
	•	waitlisted if full
	•	Existing active RSVP:
	•	toggles to cancelled
	•	Existing cancelled RSVP:
	•	reactivates to going or waitlisted

Errors
	•	EventNotFoundError
	•	InvalidEventDataError

⸻

Feature 7 — My RSVPs Dashboard

EventService.getMemberRsvpsDashboard

Returns grouped RSVP dashboard for a member.

Input

getMemberRsvpsDashboard(
  userId: string
): Promise<Result<MemberRsvpsDashboard, UnauthorizedError>>

Success Output

{
  ok: true,
  value: {
    upcoming: RsvpWithEventDetails[],
    history: RsvpWithEventDetails[]
  }
}

Errors
	•	UnauthorizedError

⸻

Feature 10 — Event Search

EventService.searchEvents

Searches published upcoming events by query.

Input

searchEvents(
  query: string
): Promise<Result<Event[], InvalidInputError>>

Success Output

{
  ok: true,
  value: Event[]
}

Behavior
	•	Empty query returns all published upcoming events
	•	Matches title, description, and location

Errors
	•	InvalidInputError

⸻

Feature 11 — Past Event Archiving

EventService.checkExpired

Transitions expired events to past status.

Input

checkExpired(): Promise<Result<void, UnexpectedDependencyError>>

Success Output

{
  ok: true,
  value: undefined
}

Errors
	•	UnexpectedDependencyError

⸻

EventService.listArchived

Returns archived/past events.

Input

listArchived(): Promise<Result<Event[], UnexpectedDependencyError>>

Success Output

{
  ok: true,
  value: Event[]
}


⸻

EventService.filterArchived

Returns archived events filtered by category.

Input

filterArchived(
  category: string
): Promise<Result<Event[], UnexpectedDependencyError>>

Success Output

{
  ok: true,
  value: Event[]
}


⸻

Feature 12 — Attendee List

EventService.getAttendeeList

Returns grouped attendee list for authorized organizer/admin.

Input

getAttendeeList(
  eventId: string,
  actor: {
    userId: string
    role: UserRole
  }
): Promise<Result<AttendeeListView, EventNotFoundError | UnauthorizedError>>

Success Output

{
  ok: true,
  value: {
    attending: AttendeeEntry[],
    waitlisted: AttendeeEntry[],
    cancelled: AttendeeEntry[]
  }
}

AttendeeEntry

{
  displayName: string
  rsvpedAt: Date
}

Errors
	•	EventNotFoundError
	•	UnauthorizedError

⸻

Feature 13 — Event Comments

EventService.createComment

Creates a comment on an event.

Input

createComment(
  userId: string,
  eventId: string,
  content: string
): Promise<Result<Comment, CreateCommentError>>

Success Output

{
  ok: true,
  value: Comment
}

Errors
	•	InvalidCommentData
	•	AuthorizationRequired
	•	EventNotFound
	•	UnexpectedDependencyError

⸻

EventService.deleteComment

Deletes a comment if permitted.

Input

deleteComment(
  actorUserId: string,
  commentId: string
): Promise<Result<Comment, DeleteCommentError>>

Success Output

{
  ok: true,
  value: Comment
}

Errors
	•	InvalidCommentData
	•	AuthorizationRequired
	•	UnauthorizedCommentDeletion
	•	CommentNotFound
	•	EventNotFound
	•	UnexpectedDependencyError

⸻

Feature 14 — Save For Later

SaveEventLater.toggleSavedEvent

Toggles saved/unsaved state for an event.

Input

toggleSavedEvent(
  userId: string,
  eventId: string
): Promise<Result<Event[], InvalidEventDataError>>

Success Output

{
  ok: true,
  value: Event[]
}

Behavior
	•	Saves event if not already saved
	•	Unsaves event if already saved
	•	No duplicates allowed

Errors
	•	InvalidEventDataError
