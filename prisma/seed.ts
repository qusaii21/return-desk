import "dotenv/config";
import { db } from "../src/lib/db";
import { REASONS, RESOLUTIONS, type Status } from "../src/lib/request-rules";

const customers = [
  { name: "Asha Rao", email: "asha.rao@example.com", phone: "+91 98200 11001" },
  { name: "Daniel Okafor", email: "daniel.okafor@example.com", phone: "+44 7700 900123" },
  { name: "Mei Lin Tan", email: "meilin.tan@example.com", phone: null },
  { name: "Carlos Mendes", email: "carlos.mendes@example.com", phone: "+55 11 91234 5678" },
  { name: "Priya Nair", email: "priya.nair@example.com", phone: "+91 98450 22002" },
  { name: "Sophie Laurent", email: "sophie.laurent@example.com", phone: "+33 6 12 34 56 78" },
  { name: "James Whitfield", email: "j.whitfield@example.com", phone: null },
  { name: "Fatima Al Farsi", email: "fatima.alfarsi@example.com", phone: "+971 50 123 4567" },
  { name: "Liam O'Connor", email: "liam.oconnor@example.com", phone: "+353 85 123 4567" },
  { name: "Ananya Iyer", email: "ananya.iyer@example.com", phone: "+91 99001 33003" },
  { name: "Noah Becker", email: "noah.becker@example.com", phone: null },
  { name: "Grace Mwangi", email: "grace.mwangi@example.com", phone: "+254 712 345 678" },
];

const items = [
  { sku: "HD-100", name: "Everyday Hoodie", price: 49.0 },
  { sku: "TS-210", name: "Organic Cotton Tee", price: 22.5 },
  { sku: "SN-330", name: "Trail Runner Sneakers", price: 89.99 },
  { sku: "BP-410", name: "Commuter Backpack 22L", price: 64.0 },
  { sku: "BT-520", name: "Insulated Steel Bottle", price: 28.0 },
  { sku: "JK-640", name: "Waterproof Shell Jacket", price: 129.0 },
  { sku: "CP-750", name: "Wool Beanie", price: 18.0 },
  { sku: "WL-860", name: "Leather Card Wallet", price: 35.0 },
  { sku: "DL-970", name: "Desk Lamp, Walnut", price: 72.5 },
  { sku: "HP-080", name: "Wireless Headphones", price: 119.0 },
];

const notesByStatus: Record<Status, string[][]> = {
  OPEN: [[], ["Customer emailed photos of the damage. Waiting for the agent to pick this up."], []],
  IN_REVIEW: [
    ["Asked the warehouse to confirm what was packed in this order."],
    ["Photos received and match the reported damage.", "Waiting on warehouse confirmation before deciding."],
    [],
  ],
  APPROVED: [
    ["Approved after checking photos. Return label sent to the customer."],
    ["Customer confirmed the item is on its way back."],
    [],
  ],
  REJECTED: [
    ["Item was worn and washed. Outside the 30 day return policy."],
    ["Customer could not provide proof of the defect."],
    [],
  ],
  COMPLETED: [
    ["Item received at the warehouse. Refund or replacement issued.", "Closed. Customer confirmed they are happy."],
    ["Replacement dispatched, tracking shared with the customer."],
    [],
  ],
};

// 36 live requests across every status, plus the cases below
const statusPlan: Status[] = [
  ...Array<Status>(8).fill("OPEN"),
  ...Array<Status>(8).fill("IN_REVIEW"),
  ...Array<Status>(7).fill("APPROVED"),
  ...Array<Status>(6).fill("REJECTED"),
  ...Array<Status>(7).fill("COMPLETED"),
];

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

async function main() {
  await db.$executeRaw`TRUNCATE TABLE "Note", "ReturnRequest"`;
  await db.$executeRaw`ALTER SEQUENCE return_reference_seq RESTART`;

  const start = Date.now() - 60 * DAY;
  let created = 0;

  async function add(
    i: number,
    status: Status,
    opts: { orderNumber?: string; item?: (typeof items)[number]; removed?: boolean; createdAt?: Date } = {},
  ) {
    const customer = customers[i % customers.length];
    const item = opts.item ?? items[(i * 3) % items.length];
    const quantity = (i % 3) + 1;
    const createdAt = opts.createdAt ?? new Date(start + (i * 60 * DAY) / statusPlan.length + (i % 5) * HOUR);
    const decided = status === "APPROVED" || status === "COMPLETED";
    const resolution = decided ? RESOLUTIONS[i % RESOLUTIONS.length] : null;
    const noteSets = notesByStatus[status];
    const notes = noteSets[i % noteSets.length];

    await db.returnRequest.create({
      data: {
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        orderNumber: opts.orderNumber ?? `ORD-${4000 + i}`,
        itemSku: item.sku,
        itemName: item.name,
        quantity,
        reason: REASONS[i % REASONS.length],
        status,
        resolution,
        refundAmount: resolution === "REFUND" ? Math.round(item.price * quantity * 100) / 100 : null,
        createdAt,
        updatedAt: status === "OPEN" ? createdAt : new Date(createdAt.getTime() + (i % 4 + 1) * DAY),
        removedAt: opts.removed ? new Date(createdAt.getTime() + DAY) : null,
        notes: {
          create: notes.map((body, n) => ({ body, createdAt: new Date(createdAt.getTime() + (n + 1) * 3 * HOUR) })),
        },
      },
    });
    created++;
  }

  for (const [i, status] of statusPlan.entries()) await add(i, status);

  // Rule 3 in the data: an earlier request for this order and item was rejected,
  // so a new live request for the same item exists alongside it.
  const repeat = items[0];
  await add(100, "REJECTED", { orderNumber: "ORD-4900", item: repeat, createdAt: new Date(start + 20 * DAY) });
  await add(101, "OPEN", { orderNumber: "ORD-4900", item: repeat, createdAt: new Date(start + 40 * DAY) });

  // Soft-deleted requests stay in the table but never show on the desk
  await add(102, "OPEN", { removed: true });
  await add(103, "REJECTED", { removed: true });

  const visible = await db.returnRequest.count({ where: { removedAt: null } });
  console.log(`Seeded ${created} requests (${visible} visible, ${created - visible} removed).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
