import assert from "node:assert/strict";
import { applyEvent, applyPresence, emptyTelephony } from "./routing.ts";

const now = "2026-10-14T00:00:00.000Z";
let state = emptyTelephony();

state = applyPresence(state, { userId: "u-aigul", role: "dispatcher", status: "available" }, now).state;
state = applyPresence(state, { userId: "u-nurlan", role: "dispatcher", status: "break" }, now).state;
state = applyPresence(state, { userId: "u-elina", role: "dispatcher", status: "available" }, now).state;

const first = applyEvent(state, { eventId: "call-1", type: "incoming", from: "+996700000001" }, now);
assert.equal(first.ok, true);
if (!first.ok) throw new Error("first");
assert.equal(first.call?.dispatcherId, "u-aigul");
state = first.state;

const second = applyEvent(state, { eventId: "call-2", type: "incoming", from: "+996700000002" }, now);
assert.equal(second.ok, true);
if (!second.ok) throw new Error("second");
assert.equal(second.call?.dispatcherId, "u-elina");
state = second.state;

const third = applyEvent(state, { eventId: "call-3", type: "incoming", from: "+996700000003" }, now);
assert.equal(third.ok, true);
if (!third.ok) throw new Error("third");
assert.equal(third.call?.state, "queued");
assert.equal(third.call?.dispatcherId, null);
state = third.state;

const duplicate = applyEvent(state, { eventId: "call-1", type: "incoming", from: "+996700000001" }, now);
assert.equal(duplicate.ok && duplicate.duplicate, true);
assert.equal(state.calls.filter((call) => call.id === "call-1").length, 1);
state = duplicate.ok ? duplicate.state : state;

const talking = applyPresence(state, { userId: "u-aigul", role: "dispatcher", status: "talking" as "available" }, now);
assert.equal(talking.ok, false);

const ended = applyEvent(state, { eventId: "end-1", type: "ended", callId: "call-1" }, now);
assert.equal(ended.ok, true);
if (!ended.ok) throw new Error("ended");
const freed = ended.state.calls.find((call) => call.id === "call-3");
assert.equal(freed?.dispatcherId, "u-aigul");
assert.equal(ended.state.calls.find((call) => call.id === "call-1")?.result, "missed");

console.log("telephony routing ok");
