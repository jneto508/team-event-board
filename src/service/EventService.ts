import { Result } from "../lib/result";
import { IEvent, EventStatus} from "../model/Event";
import { EventError } from "../service/errors"
import { EventInput } from "../repository/EventRepository";


export interface IEventService {
  createEvent(data: EventInput): Promise<Result<IEvent, EventError>>;
  getEventById(id: number): Promise<Result<IEvent, EventError>>;
  deleteEvent(id: number): Promise<Result<void, EventError>>;
  updateEvent(id: number, data: EventInput): Promise<Result<void, EventError>>;
}