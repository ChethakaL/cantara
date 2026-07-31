import {
  executeMondayTool,
  executeMondayGraphqlDirect,
  unwrapMondayToolData,
} from "./monday-api";

export function findMondayItemId(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  for (const key of ["id", "item_id", "pulse_id"]) {
    const candidate = record[key];
    if (typeof candidate === "string" || typeof candidate === "number") return String(candidate);
  }
  for (const child of Object.values(record)) {
    const nested = findMondayItemId(child);
    if (nested) return nested;
  }
  return null;
}

function findMondayItemsPagePayload(payload: Record<string, unknown> | null): {
  items: unknown[];
  cursor?: string;
} | null {
  if (!payload) return null;
  const tryPage = (p: unknown) => {
    if (!p || typeof p !== "object") return null;
    const o = p as Record<string, unknown>;
    const items = o.items;
    if (!Array.isArray(items)) return null;
    const cursor =
      (typeof o.cursor === "string" && o.cursor) ||
      (typeof o.next_cursor === "string" && o.next_cursor) ||
      undefined;
    return { items, cursor };
  };

  const root = tryPage(payload);
  if (root) return root;

  const boards = payload.boards;
  if (Array.isArray(boards) && boards[0] && typeof boards[0] === "object") {
    const b0 = boards[0] as Record<string, unknown>;
    const fromIp = tryPage(b0.items_page);
    if (fromIp) return fromIp;
  }

  const direct = tryPage(payload.items_page);
  if (direct) return direct;

  const data = payload.data;
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    const bs = d.boards;
    if (Array.isArray(bs) && bs[0] && typeof bs[0] === "object") {
      const b0 = bs[0] as Record<string, unknown>;
      const fromIp = tryPage(b0.items_page);
      if (fromIp) return fromIp;
    }
  }

  const raw = payload.raw_response;
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    const d = r.data;
    if (d && typeof d === "object") {
      const dd = d as Record<string, unknown>;
      const bs = dd.boards;
      if (Array.isArray(bs) && bs[0] && typeof bs[0] === "object") {
        const b0 = bs[0] as Record<string, unknown>;
        const fromIp = tryPage(b0.items_page);
        if (fromIp) return fromIp;
      }
    }
  }

  return null;
}

export async function collectMondayBoardItemsViaItemsPage(boardId: string): Promise<any[]> {
  const boardIdNum = parseInt(boardId, 10);
  if (Number.isNaN(boardIdNum)) return [];

  const byId = new Map<string, any>();
  let cursor: string | undefined;

  for (let safety = 0; safety < 40; safety++) {
    const args: Record<string, unknown> = {
      board_id: boardIdNum,
      limit: 500,
      include_column_values: true,
    };
    if (cursor) args.cursor = cursor;

    let result: { data?: unknown; successful?: boolean } | null = null;
    try {
      result = await executeMondayTool<unknown>("MONDAY_ITEMS_PAGE", args);
    } catch (e) {
      console.log("[Composio] MONDAY_ITEMS_PAGE request failed:", e);
      break;
    }

    if (!result?.successful) {
      console.log("[Composio] MONDAY_ITEMS_PAGE unsuccessful");
      break;
    }

    const payload = unwrapMondayToolData(result.data);
    const page = findMondayItemsPagePayload(payload);
    if (!page) {
      console.log("[Composio] MONDAY_ITEMS_PAGE could not parse items_page from payload keys:", payload ? Object.keys(payload) : []);
      break;
    }

    for (const item of page.items) {
      if (item && typeof item === "object") {
        const id = String((item as any).id ?? (item as any).item_id ?? "");
        if (id) byId.set(id, item);
      }
    }

    const next = page.cursor;
    if (!next || page.items.length === 0) break;
    cursor = next;
  }

  return Array.from(byId.values());
}

const EMAIL_LIKE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

export function columnTitle(cv: any): string {
  return String(cv?.title ?? cv?.column?.title ?? cv?.id ?? "").trim();
}

export function extractEmailFromMondayColumns(item: any): string {
  const columnValues = item.column_values || item.values || [];
  if (!Array.isArray(columnValues)) return "";

  const emailCol = columnValues.find(
    (cv: any) =>
      columnTitle(cv).toLowerCase().includes("email") ||
      String(cv?.id || "").toLowerCase().includes("email") ||
      cv?.type === "email"
  );
  if (emailCol) {
    const direct = String(emailCol.text || "").trim();
    if (direct) return direct.toLowerCase();
    if (emailCol.value != null) {
      try {
        const parsed = typeof emailCol.value === "string" ? JSON.parse(emailCol.value) : emailCol.value;
        const fromParsed = String(parsed?.email || parsed?.text || parsed?.value || "").trim();
        if (fromParsed) return fromParsed.toLowerCase();
      } catch {
        /* ignore */
      }
    }
  }

  for (const cv of columnValues) {
    const t = String(cv?.text || "").trim();
    const m = t.match(EMAIL_LIKE);
    if (m) return m[0].toLowerCase();
    if (cv?.value != null && typeof cv.value === "string") {
      try {
        const parsed = JSON.parse(cv.value);
        const nested = String(parsed?.email || parsed?.text || "").trim();
        const m2 = nested.match(EMAIL_LIKE);
        if (m2) return m2[0].toLowerCase();
      } catch {
        /* ignore */
      }
    }
  }

  return "";
}

export function slimColumnValuesForApi(item: any): Array<{ id: string; title: string; type: string; text: string; value?: string }> {
  const columnValues = item.column_values || item.values || [];
  if (!Array.isArray(columnValues)) return [];
  return columnValues.map((cv: any) => ({
    id: String(cv.id ?? ""),
    title: columnTitle(cv) || String(cv.id ?? ""),
    type: String(cv.type ?? ""),
    text: String(cv.text ?? "").trim(),
    value: cv.value != null ? (typeof cv.value === "string" ? cv.value : JSON.stringify(cv.value)) : undefined,
  }));
}

export async function getMondayBoardItems(boardId: string) {
  let bestResult: any[] = [];
  let foundColumnData = false;

  try {
    console.log(`[Composio] MONDAY_ITEMS_PAGE for board ${boardId}...`);
    const pageItems = await collectMondayBoardItemsViaItemsPage(boardId);
    if (pageItems.length > 0) {
      bestResult = pageItems;
      foundColumnData = pageItems.some(
        (i) => Array.isArray(i.column_values) && i.column_values.length > 0
      );
      console.log(
        `[Composio] MONDAY_ITEMS_PAGE collected ${pageItems.length} items. Has column_values: ${foundColumnData}`
      );
    }
  } catch (e) {
    console.log("[Composio] MONDAY_ITEMS_PAGE failed:", e);
  }

  if (bestResult.length === 0 || !foundColumnData) {
    console.log(`[Monday] Direct GraphQL items_page for board ${boardId}...`);
    try {
      const gqlResult = await executeMondayGraphqlDirect({
        query: `
          query ($boardId: [ID!]) {
            boards(ids: $boardId) {
              items_page(limit: 500) {
                items {
                  id
                  name
                  column_values {
                    id
                    type
                    text
                    value
                    column { title }
                  }
                }
              }
            }
          }
        `,
        variables: { boardId: [boardId] },
      });
      const boards = (gqlResult?.data as any)?.boards as unknown[] | undefined;
      let items: any[] | undefined;
      if (Array.isArray(boards) && boards[0] && typeof boards[0] === "object") {
        const ip = (boards[0] as Record<string, unknown>).items_page as Record<string, unknown> | undefined;
        if (ip && Array.isArray(ip.items)) items = ip.items as any[];
      }
      if (Array.isArray(items) && items.length > 0) {
        const hasCols = items.some((i) => Array.isArray(i.column_values) && i.column_values.length > 0);
        if (bestResult.length === 0 || hasCols) {
          bestResult = items;
          foundColumnData = hasCols;
        }
        console.log(
          `[Monday] Direct GraphQL returned ${items.length} items. column_values: ${hasCols}`
        );
      }
    } catch (e) {
      console.log(`[Monday] Direct GraphQL items_page failed:`, e);
    }
  }

  if (bestResult.length === 0) {
    const toolNames = ["MONDAY_GET_BOARD", "MONDAY_LIST_BOARD_ITEMS"];

    for (const toolName of toolNames) {
      try {
        console.log(`[Composio] Trying ${toolName} for board ${boardId}...`);
        const payload: Record<string, unknown> = { board_id: boardId };
        if (toolName === "MONDAY_GET_BOARD") payload.id = boardId;

        const result = await executeMondayTool<any>(toolName, payload);

        if (result?.successful && result?.data) {
          const dataObj = unwrapMondayToolData(result.data) ?? (result.data as Record<string, unknown>);
          let rawItems =
            (dataObj as any)?.items ??
            (dataObj as any)?.details ??
            (dataObj as any)?.boards?.[0]?.items ??
            (dataObj as any)?.boards?.[0]?.items_page?.items ??
            result.data?.boards?.[0]?.items_page?.items ??
            result.data?.boards?.[0]?.items ??
            result.data?.items ??
            [];

          if (!Array.isArray(rawItems) || rawItems.length === 0) {
            const groups = (dataObj as any)?.boards?.[0]?.groups || result.data?.boards?.[0]?.groups || [];
            if (Array.isArray(groups)) {
              rawItems = groups.flatMap((g: any) => g.items || []);
            }
          }

          const items = Array.isArray(rawItems) ? rawItems : [];

          if (items.length > 0) {
            const hasColumns = items.some((i: any) => i.column_values || i.values);
            console.log(`[Composio] ${toolName} found ${items.length} items. Has columns: ${hasColumns}`);

            if (bestResult.length === 0 || (hasColumns && !foundColumnData)) {
              bestResult = items;
              foundColumnData = hasColumns;
            }
            if (hasColumns) break;
          }
        }
      } catch (e) {
        console.log(`[Composio] ${toolName} failed or not found.`);
      }
    }
  }

  if (bestResult.length > 0 && !foundColumnData) {
    const itemIds = bestResult.map((i) => String(i.id || i.item_id || i.pulse_id)).filter(Boolean);
    console.log(`[Composio] No column_values yet; MONDAY_GET_ITEMS for ${itemIds.length} ids (metadata only)...`);
    try {
      const enrichment = await executeMondayTool<any>("MONDAY_GET_ITEMS", { ids: itemIds });
      if (enrichment?.successful && enrichment?.data) {
        const dataObj = unwrapMondayToolData(enrichment.data) ?? enrichment.data;
        const enrichedItems =
          (dataObj as any)?.items ??
          (dataObj as any)?.details ??
          (dataObj as any)?.data?.items ??
          (dataObj as any)?.raw_response?.data?.items ??
          [];

        if (Array.isArray(enrichedItems) && enrichedItems.length > 0) {
          bestResult = bestResult.map((original) => {
            const enriched = enrichedItems.find(
              (e: any) => String(e.id || e.item_id) === String(original.id)
            );
            return enriched ? { ...original, ...enriched } : original;
          });
        }
      }
    } catch (e) {
      console.log(`[Composio] MONDAY_GET_ITEMS fallback failed:`, e);
    }
  }

  if (bestResult.length === 0) {
    console.log("[Composio] No items found across all tried tools.");
  }

  return bestResult
    .map((i: any) => {
      const email = extractEmailFromMondayColumns(i);
      return {
        id: String(i.id || i.item_id || i.pulse_id || ""),
        name: String(i.name || i.title || i.text || "Untitled Item"),
        email,
        columnValues: slimColumnValuesForApi(i),
      };
    })
    .filter((row) => row.id);
}

export async function createMondayBoardItem(args: {
  boardId: string;
  itemName: string;
  columnValues: Record<string, unknown>;
}) {
  let itemId: string | null = null;

  try {
    const toolResult = await executeMondayTool<any>("MONDAY_CREATE_ITEM", {
      board_id: args.boardId,
      item_name: args.itemName,
    });
    const toolId = findMondayItemId(unwrapMondayToolData(toolResult?.data) ?? toolResult?.data);
    if (toolId) itemId = String(toolId);
  } catch (error) {
    console.warn("[Monday] MONDAY_CREATE_ITEM tool call failed; falling back to direct GraphQL.", error);
  }

  if (!itemId) {
    // Composio may have created the item before returning an error/unparseable
    // payload. Prefer linking by name over a second create_item.
    try {
      const existing = (await getMondayBoardItems(args.boardId)).find(
        (item) => item.name.trim().toLowerCase() === args.itemName.trim().toLowerCase(),
      );
      if (existing?.id) itemId = String(existing.id);
    } catch (lookupError) {
      console.warn("[Monday] Post-create name lookup failed before GraphQL fallback.", lookupError);
    }
  }

  if (!itemId) {
    const result = await executeMondayGraphqlDirect({
      query: `
        mutation ($boardId: ID!, $itemName: String!) {
          create_item(board_id: $boardId, item_name: $itemName) { id }
        }
      `,
      variables: {
        boardId: args.boardId,
        itemName: args.itemName,
      },
    });
    const parsedId = findMondayItemId(result?.data);
    if (parsedId) itemId = String(parsedId);
  }

  if (!itemId) throw new Error("Monday item could not be created.");

  if (args.columnValues && Object.keys(args.columnValues).length > 0) {
    await updateMondayBoardItem({
      boardId: args.boardId,
      itemId,
      columnValues: args.columnValues,
    }).catch((err) => console.warn("[Monday] Column values update warning after item creation:", err));
  }

  return itemId;
}

export async function updateMondayBoardItem(args: {
  boardId: string;
  itemId: string;
  columnValues: Record<string, unknown>;
}) {
  const cleanValues = Object.fromEntries(
    Object.entries(args.columnValues || {}).filter(([_, v]) => v !== null && v !== undefined)
  );

  if (Object.keys(cleanValues).length === 0) return true;
  const jsonString = JSON.stringify(cleanValues);

  try {
    const toolResult = await executeMondayTool<any>("MONDAY_CHANGE_MULTIPLE_COLUMN_VALUES", {
      board_id: args.boardId,
      item_id: args.itemId,
      column_values: jsonString,
    });
    if (toolResult?.successful !== false && toolResult?.data) return true;
  } catch (error) {
    // Continue to column fallback
  }

  let updatedAny = false;
  for (const [columnId, colVal] of Object.entries(cleanValues)) {
    try {
      const res = await executeMondayTool<any>("MONDAY_UPDATE_ITEM", {
        board_id: args.boardId,
        item_id: args.itemId,
        column_id: columnId,
        value: colVal,
      });
      if (res?.successful !== false) updatedAny = true;
    } catch {
      // Continue to next column
    }
  }

  return updatedAny;
}
