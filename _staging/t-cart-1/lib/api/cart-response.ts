import { getDistributor, getMedicine, listCartItems } from "@/lib/db/store";

export interface CartLine {
  medicineId: string;
  name: string;
  brand: string;
  qty: number;
  unitPricePaise: number;
  lineTotalPaise: number;
}

export interface CartGroup {
  distributor: { id: string; name: string };
  items: CartLine[];
  subtotalPaise: number;
}

export interface CartResponse {
  groups: CartGroup[];
  grandTotalPaise: number;
  itemCount: number;
}

export function buildCartResponse(retailerId: string): CartResponse {
  const items = listCartItems(retailerId);
  const groupsMap = new Map<string, CartGroup>();
  let grandTotalPaise = 0;
  let itemCount = 0;

  for (const item of items) {
    const med = getMedicine(item.medicineId);
    if (!med) continue;
    const dist = getDistributor(item.distributorId);
    const distributor = dist
      ? { id: dist.id, name: dist.name }
      : { id: item.distributorId, name: "Unknown distributor" };

    const lineTotal = item.qty * item.unitPricePaise;
    grandTotalPaise += lineTotal;
    itemCount += item.qty;

    let group = groupsMap.get(item.distributorId);
    if (!group) {
      group = { distributor, items: [], subtotalPaise: 0 };
      groupsMap.set(item.distributorId, group);
    }
    group.items.push({
      medicineId: item.medicineId,
      name: med.name,
      brand: med.brand,
      qty: item.qty,
      unitPricePaise: item.unitPricePaise,
      lineTotalPaise: lineTotal,
    });
    group.subtotalPaise += lineTotal;
  }

  const groups = Array.from(groupsMap.values()).sort((a, b) =>
    a.distributor.name.localeCompare(b.distributor.name),
  );
  return { groups, grandTotalPaise, itemCount };
}
