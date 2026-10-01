// Black-box tests for the business rules. They call the running API over HTTP,
// so start the app first: npm run dev (or npm start), then npm test.
import assert from "node:assert/strict";
import { test } from "node:test";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const run = Date.now().toString(36).toUpperCase();
let counter = 0;

async function call(method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE}/api/requests${path}`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = res.status === 204 ? null : await res.json();
  return { status: res.status, body: json };
}

const newInput = (order = `T-${run}-${++counter}`, sku = "SKU-1") => ({
  customerName: "Test Customer",
  customerEmail: "test@example.com",
  orderNumber: order,
  itemSku: sku,
  itemName: "Test Item",
  quantity: 1,
  reason: "DAMAGED",
});

async function create(input = newInput()) {
  const res = await call("POST", "", input);
  assert.equal(res.status, 201);
  return res.body.id as string;
}

const move = (id: string, status: string, extra: object = {}) =>
  call("POST", `/${id}/transition`, { status, ...extra });

async function createAt(status: string) {
  const id = await create();
  if (status === "OPEN") return id;
  assert.equal((await move(id, "IN_REVIEW")).status, 200);
  if (status === "IN_REVIEW") return id;
  if (status === "REJECTED") {
    assert.equal((await move(id, "REJECTED")).status, 200);
    return id;
  }
  assert.equal((await move(id, "APPROVED", { resolution: "REPLACEMENT" })).status, 200);
  if (status === "COMPLETED") assert.equal((await move(id, "COMPLETED")).status, 200);
  return id;
}

test("legal status transitions succeed", async () => {
  const id = await create();
  assert.equal((await move(id, "IN_REVIEW")).status, 200);
  assert.equal((await move(id, "APPROVED", { resolution: "REFUND", refundAmount: 10 })).status, 200);
  const done = await move(id, "COMPLETED");
  assert.equal(done.status, 200);
  assert.equal(done.body.status, "COMPLETED");

  const rejected = await createAt("IN_REVIEW");
  assert.equal((await move(rejected, "REJECTED")).status, 200);
});

test("illegal status transitions are refused with 409", async () => {
  const cases: [string, string][] = [
    ["OPEN", "APPROVED"],
    ["OPEN", "COMPLETED"],
    ["OPEN", "REJECTED"],
    ["APPROVED", "REJECTED"],
    ["APPROVED", "IN_REVIEW"],
    ["COMPLETED", "OPEN"],
    ["COMPLETED", "IN_REVIEW"],
    ["COMPLETED", "REJECTED"],
    ["REJECTED", "IN_REVIEW"],
    ["REJECTED", "APPROVED"],
    ["REJECTED", "COMPLETED"],
  ];
  for (const [from, to] of cases) {
    const id = await createAt(from);
    const res = await move(id, to, to === "APPROVED" ? { resolution: "REPLACEMENT" } : {});
    assert.equal(res.status, 409, `${from} -> ${to}`);
    assert.equal(res.body.error.code, "INVALID_STATUS_TRANSITION", `${from} -> ${to}`);
  }
});

test("approval resolution rules", async () => {
  const refundOk = await createAt("IN_REVIEW");
  const ok = await move(refundOk, "APPROVED", { resolution: "REFUND", refundAmount: 19.99 });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.refundAmount, 19.99);

  const failures: [object, string][] = [
    [{ resolution: "REFUND", refundAmount: 0 }, "INVALID_REFUND_AMOUNT"],
    [{ resolution: "REFUND", refundAmount: -5 }, "INVALID_REFUND_AMOUNT"],
    [{ resolution: "REFUND" }, "INVALID_REFUND_AMOUNT"],
    [{ resolution: "REPLACEMENT", refundAmount: 5 }, "INVALID_REFUND_AMOUNT"],
    [{ resolution: "STORE_CREDIT", refundAmount: 5 }, "INVALID_REFUND_AMOUNT"],
    [{}, "INVALID_RESOLUTION"],
  ];
  for (const [payload, code] of failures) {
    const id = await createAt("IN_REVIEW");
    const res = await move(id, "APPROVED", payload);
    assert.equal(res.status, 422, JSON.stringify(payload));
    assert.equal(res.body.error.code, code, JSON.stringify(payload));
    assert.equal((await call("GET", `/${id}`)).body.status, "IN_REVIEW", "a refused approval must not change status");
  }

  for (const resolution of ["REPLACEMENT", "STORE_CREDIT"]) {
    const id = await createAt("IN_REVIEW");
    const res = await move(id, "APPROVED", { resolution });
    assert.equal(res.status, 200);
    assert.equal(res.body.refundAmount, null);
  }
});

test("only one live request per item on an order", async () => {
  const input = newInput();
  const first = await create(input);

  const dup = await call("POST", "", { ...input, orderNumber: input.orderNumber.toLowerCase() });
  assert.equal(dup.status, 409);
  assert.equal(dup.body.error.code, "DUPLICATE_LIVE_REQUEST");

  // another item on the same order is fine
  assert.equal((await call("POST", "", { ...input, itemSku: "SKU-2" })).status, 201);

  // still live while In Review and Approved
  await move(first, "IN_REVIEW");
  assert.equal((await call("POST", "", input)).status, 409);
  await move(first, "APPROVED", { resolution: "STORE_CREDIT" });
  assert.equal((await call("POST", "", input)).status, 409);

  // closed once Completed
  await move(first, "COMPLETED");
  assert.equal((await call("POST", "", input)).status, 201);
});

test("a new request is allowed once the earlier one was Rejected", async () => {
  const input = newInput();
  const first = await create(input);
  await move(first, "IN_REVIEW");
  await move(first, "REJECTED");
  assert.equal((await call("POST", "", input)).status, 201);
});

test("editing an item into a live duplicate is refused", async () => {
  const a = newInput();
  await create(a);
  const b = await create(newInput(a.orderNumber, "SKU-9"));
  const res = await call("PATCH", `/${b}`, { itemSku: a.itemSku });
  assert.equal(res.status, 409);
  assert.equal(res.body.error.code, "DUPLICATE_LIVE_REQUEST");
});

test("details are locked once Approved, Rejected or Completed", async () => {
  for (const status of ["APPROVED", "REJECTED", "COMPLETED"]) {
    const id = await createAt(status);
    for (const patch of [{ customerName: "Changed" }, { itemName: "Changed" }, { quantity: 3 }]) {
      const res = await call("PATCH", `/${id}`, patch);
      assert.equal(res.status, 409, `${status} ${JSON.stringify(patch)}`);
      assert.equal(res.body.error.code, "REQUEST_LOCKED");
    }
    assert.equal((await call("GET", `/${id}`)).body.customerName, "Test Customer");
  }
});

test("details can be edited while Open or In Review", async () => {
  for (const status of ["OPEN", "IN_REVIEW"]) {
    const id = await createAt(status);
    const res = await call("PATCH", `/${id}`, { customerName: "Corrected", quantity: 2 });
    assert.equal(res.status, 200);
    assert.equal(res.body.customerName, "Corrected");
    assert.equal(res.body.quantity, 2);
  }
});

test("notes can be added at any status, including locked ones", async () => {
  for (const status of ["OPEN", "IN_REVIEW", "APPROVED", "REJECTED", "COMPLETED"]) {
    const id = await createAt(status);
    const res = await call("POST", `/${id}/notes`, { body: `note on ${status}` });
    assert.equal(res.status, 201);
    const detail = await call("GET", `/${id}`);
    assert.equal(detail.body.notes.at(-1).body, `note on ${status}`);
  }
});

test("notes are returned oldest first and cannot be edited or deleted", async () => {
  const id = await create();
  await call("POST", `/${id}/notes`, { body: "first" });
  await call("POST", `/${id}/notes`, { body: "second" });
  const detail = await call("GET", `/${id}`);
  assert.deepEqual(detail.body.notes.map((n: { body: string }) => n.body), ["first", "second"]);
  const noteId = detail.body.notes[0].id;
  assert.equal((await call("PATCH", `/${id}/notes/${noteId}`, { body: "x" })).status, 404);
  assert.equal((await call("DELETE", `/${id}/notes/${noteId}`)).status, 404);
});

test("only Open and Rejected requests can be removed", async () => {
  for (const status of ["IN_REVIEW", "APPROVED", "COMPLETED"]) {
    const id = await createAt(status);
    const res = await call("DELETE", `/${id}`);
    assert.equal(res.status, 409, status);
    assert.equal(res.body.error.code, "REMOVAL_NOT_ALLOWED");
    assert.equal((await call("GET", `/${id}`)).status, 200);
  }
  for (const status of ["OPEN", "REJECTED"]) {
    const id = await createAt(status);
    assert.equal((await call("DELETE", `/${id}`)).status, 204, status);
  }
});

test("a removed request is gone from the API and frees the item", async () => {
  const input = newInput();
  const id = await create(input);
  const reference = (await call("GET", `/${id}`)).body.reference;
  await call("DELETE", `/${id}`);

  assert.equal((await call("GET", `/${id}`)).status, 404);
  assert.equal((await call("DELETE", `/${id}`)).status, 404);
  assert.equal((await call("PATCH", `/${id}`, { customerName: "x" })).status, 404);
  assert.equal((await call("POST", `/${id}/notes`, { body: "x" })).status, 404);
  assert.equal((await move(id, "IN_REVIEW")).status, 404);
  const list = await call("GET", `?search=${reference}`);
  assert.equal(list.body.total, 0);

  // taking it off the desk also frees the item for a new request
  assert.equal((await call("POST", "", input)).status, 201);
});

test("every request gets a unique generated reference", async () => {
  const a = await call("GET", `/${await create()}`);
  const b = await call("GET", `/${await create()}`);
  assert.match(a.body.reference, /^RET-\d{4}-\d{6}$/);
  assert.notEqual(a.body.reference, b.body.reference);
  const res = await call("POST", "", { ...newInput(), reference: "RET-2026-999999" });
  assert.match((await call("GET", `/${res.body.id}`)).body.reference, /^RET-\d{4}-\d{6}$/);
  assert.notEqual(res.body.reference, "RET-2026-999999");
});

test("invalid input returns 400 with a machine-readable error", async () => {
  const bad: object[] = [
    { ...newInput(), customerEmail: "not-an-email" },
    { ...newInput(), quantity: 0 },
    { ...newInput(), quantity: 1.5 },
    { ...newInput(), reason: "BORED" },
    { ...newInput(), customerName: "   " },
  ];
  for (const input of bad) {
    const res = await call("POST", "", input);
    assert.equal(res.status, 400, JSON.stringify(input));
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
  }
  assert.equal((await call("GET", "/not-a-uuid")).status, 400);
  assert.equal((await call("GET", "/00000000-0000-4000-8000-000000000000")).status, 404);

  const id = await create();
  assert.equal((await call("POST", `/${id}/notes`, { body: "  " })).status, 400);
  assert.equal((await move(id, "NOPE")).status, 400);
  assert.equal((await call("PATCH", `/${id}`, {})).status, 400);

  const res = await fetch(`${BASE}/api/requests`, { method: "POST", body: "{not json" });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.code, "INVALID_JSON");
});

test("search, filter, sort and pagination work together on the server", async () => {
  const tag = `Findme${run}`;
  for (const [reason, status] of [["DAMAGED", "OPEN"], ["DAMAGED", "IN_REVIEW"], ["WRONG_ITEM", "OPEN"]]) {
    const id = await create({ ...newInput(), customerName: `${tag} ${reason}`, reason } as ReturnType<typeof newInput>);
    if (status === "IN_REVIEW") await move(id, "IN_REVIEW");
  }

  const all = await call("GET", `?search=${tag}`);
  assert.equal(all.body.total, 3);

  const damagedOpen = await call("GET", `?search=${tag.toLowerCase()}&reason=DAMAGED&status=OPEN`);
  assert.equal(damagedOpen.body.total, 1);

  const sorted = await call("GET", `?search=${tag}&sort=customerName&order=asc&pageSize=2`);
  assert.equal(sorted.body.data.length, 2);
  assert.equal(sorted.body.totalPages, 2);
  assert.equal(sorted.body.data[0].customerName, `${tag} DAMAGED`);
  const page2 = await call("GET", `?search=${tag}&sort=customerName&order=asc&pageSize=2&page=2`);
  assert.equal(page2.body.data.length, 1);
  assert.equal(page2.body.data[0].customerName, `${tag} WRONG_ITEM`);

  const byOrder = await call("GET", `?search=${all.body.data[0].orderNumber}`);
  assert.equal(byOrder.body.total, 1);
  const byReference = await call("GET", `?search=${all.body.data[0].reference}`);
  assert.equal(byReference.body.total, 1);

  assert.equal((await call("GET", "?status=BOGUS")).status, 400);
  assert.equal((await call("GET", "?sort=password")).status, 400);
  assert.equal((await call("GET", "?pageSize=101")).status, 400);
  assert.equal((await call("GET", "?page=0")).status, 400);
});
