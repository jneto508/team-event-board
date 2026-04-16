#Interface Contract

An Interface contract that defines what each module expects as input and output

# Feature 1 Service Methods
Event createEvent(): 
On error returns InvalidInputError
Calls createEvent() in EventRepository
boolean validateEventInput(): 

# Feature 2 Service Methods (Erik)
Calls EventService.getEventById() (see Feature 3)
Visibility rule
draft events return EventNotFoundError for anyone except the creating organizer or an admin



# Feature 3 Service Methods
EventService.getEventByID(eventId: string): 
On error returns InvalidEventError
EventService.updateEvent()

#Feature 4 Service Methods (Nick)
EventService.toggleRSVP(e_id: event id, u_id: user id):
On error returns EventNotFound or InvalidEventData, depending on input
If successful, calls repository to add user u to attending list of event e if not already. If user u is already in the attending list, then it removes them.
#Feature 10 Service Methods
# EventService.searchEvents()
#Description- Searches for an event that matches a given query string. Only uses in-memory  data. Event search is based on name,title, or description.

#Input- 
{
"query": "string"
}

#Output-
​​[
  {
    "id": "string",
    "title": "string",
    "description": "string",
    "location": "string",
    "date": "string",
    "isPublished": "boolean"
  }
]



#Feature 11 Service Methods (Nick)
EventService.checkExpired():
Is called on server start and periodically thereafter by the server on a clock (?), no user input required.
On error returns UnexpectedDependencyError
If successful, calls the repository to check every event if they are past expiry/end date, and if they are, updates their status to past
EventService.listArchived():
Gets all past/archived events
On error returns UnexpectedDependencyError
EventService.filterArchived(c: category):
Filters all past/archived events
On error returns UnexpectedDependencyError

# Feature 12 Service Methods (Erik)
# Description - 

EventService.getAttendeeList(eventId: string, requestingUser: User)
On error returns EventNotFound error or UnauthorizedError depending on input
If successful returns attendees list grouped by RSVP Status (attending, waitlisted, canceled) sorted by RSVP creation date
Only the event's organizer or an admin may call this and all others receive UnauthorizedError

# Output: { attending: AttendeeEntry[], waitlisted: AttendeeEntry[], cancelled: AttendeeEntry[] } * AttendeeEntry: { displayName: string, rsvpedAt: Date }


#Feature 14 Service Methods

#SaveEventLater.toggleSavedEvent()

#Description- Toggles saved status of event. If an event is not saved it will be saved.
If event already saved it is removed(unsaved)

#Input-
{
  "userId": "string"
}

#Output-
[
  {
    "id": "string",
    "title": "string",
    "description": "string",
    "location": "string",
    "date": "string (ISO format)",
    "isPublished": "boolean"
  }
]


#Feature 7 Service Methods

#Description- Displays a dashboard to users of every event they’ve RSVP’d to. Events get grouped into two sections: upcoming events and past/cancelled events. Organizers do not go to events, they don’t see this dashboard.

#Input- getMemberRsvpsDashboard(userId: string): Result<MemberRsvpsDashboard, GetMemberRsvpsDashboardError>

#Output- {
ok: true,
value: {
upcoming: RsvpWithEventDetails[],
history: RsvpWithEventDetails[]
}
}

#Feature 13 Service Methods
#Description- Creates a comment on an event that authenticated users can use.

#Input- createComment(userId: string, eventId: string, content: string): Result<Comment, CreateCommentError>

#Output- {
  ok: true,
  value: Comment
}

#Input 2- deleteComment(actorUserId: string, commentId: string): Result<Comment, DeleteCommentError>

#Output 2- {
  ok: true,
  value: Comment
}
