export interface IComment {
  id: number;
  eventId: number;
  userId: string;
  content: string;
  createdAt: Date;
}

export interface CreateCommentData {
  eventId: number;
  userId: string;
  content: string;
  createdAt?: Date;
}

function normalizeContent(content: string): string {
  return String(content ?? "").trim();
}

export class Comment implements IComment {
  id: number;
  eventId: number;
  userId: string;
  content: string;
  createdAt: Date;

  constructor(id: number, data: CreateCommentData) {
    this.id = id;
    this.eventId = data.eventId;
    this.userId = data.userId;
    this.content = normalizeContent(data.content);
    this.createdAt = data.createdAt ?? new Date();
  }
}

export function createComment(id: number, data: CreateCommentData): IComment {
  return new Comment(id, data);
}
