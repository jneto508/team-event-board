import request from "supertest";
import { createComposedApp } from "../../src/composition";

const VALID_EVENT = {
  title: "Test Workshop",
  description: "A hands-on workshop for testing purposes.",
  location: "Room 101",
  category: "workshop",
  capacity: "30",
  startDateTime: "2099-06-01T10:00",
  endDateTime: "2099-06-01T12:00",
};

describe("Event creation routes", () => {
  describe("POST /events — happy path", () => {});

  describe("POST /events — authentication errors", () => {});

  describe("POST /events — InvalidEventData errors", () => {});

  describe("POST /events — ValidationError errors", () => {});
});
