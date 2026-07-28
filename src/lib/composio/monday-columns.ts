import {
  getStoredMondayBoardId,
  getStoredMondayColumnMapping,
} from "@/lib/secure-settings";
import { getMondayLinkColumnKey, sanitizeMondayLinkUrl } from "@/lib/monday-settings";
import { composioFetch } from "./client";
import {
  executeMondayTool,
  executeMondayGraphqlDirect,
  unwrapMondayToolData,
  getMondayConnection,
} from "./monday-api";
import {
  collectMondayBoardItemsViaItemsPage,
  slimColumnValuesForApi,
} from "./monday-items";

export async function getMondayBoards() {
  let result: any = null;

  try {
    result = await executeMondayTool<any>("MONDAY_LIST_BOARDS", { limit: 50 });
  } catch (e) {
    console.log("[Composio] MONDAY_LIST_BOARDS failed, trying fallback...");
  }

  if (!result?.successful || !result?.data) {
    try {
      result = await executeMondayTool<any>("MONDAY_BOARDS", { limit: 50 });
    } catch (e) {
      console.log("[Composio] MONDAY_BOARDS failed as well.");
    }
  }

  const rawBoards =
    result?.data?.boards ??
    result?.data?.details ??
    result?.data?.raw_response?.data?.boards ??
    result?.data?.data?.boards ??
    result?.data?.data ??
    [];
  const boards = Array.isArray(rawBoards) ? rawBoards : [];

  return boards
    .map((b: any) => ({
      id: String(b.id || b.board_id || ""),
      name: String(b.name || b.title || "Untitled Board"),
    }))
    .filter((b) => b.id);
}

export async function getMondayBoardColumns(boardId: string) {
  const connection = await getMondayConnection();
  if (!connection) throw new Error("No Monday.com connection found");

  const columnsResult = await executeMondayTool<any>("MONDAY_LIST_COLUMNS", { board_id: boardId }).catch(() => null);
  const columnsPayload = unwrapMondayToolData(columnsResult?.data);
  const columnsFromTool =
    (columnsPayload as any)?.columns ??
    (columnsPayload as any)?.raw_response?.data?.boards?.[0]?.columns ??
    (columnsPayload as any)?.data?.boards?.[0]?.columns ??
    [];
  if (Array.isArray(columnsFromTool) && columnsFromTool.length > 0) {
    return columnsFromTool
      .map((column: any) => ({
        id: String(column.id || ""),
        title: String(column.title || column.id || ""),
        type: String(column.type || "text"),
      }))
      .filter((column: { id: string }) => column.id);
  }

  const connectionDetails = await composioFetch<any>(`/connected_accounts/${connection.id}`).catch(() => null);
  const authHeader =
    connectionDetails?.params?.headers?.Authorization ||
    connectionDetails?.connection?.access_token ||
    connectionDetails?.params?.access_token ||
    connectionDetails?.data?.access_token;

  const gql = `query { boards(ids: [${boardId}]) { id name columns { id title type } } }`;
  if (authHeader && String(authHeader).length > 20) {
    const mondayRes = await fetch("https://api.monday.com/v2", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: String(authHeader),
        "API-Version": "2024-01",
      },
      body: JSON.stringify({ query: gql }),
      cache: "no-store",
    });

    const mondayJson = await mondayRes.json().catch(() => null);
    if (!mondayRes.ok) {
      throw new Error(`Monday.com API responded with status ${mondayRes.status}: ${JSON.stringify(mondayJson).slice(0, 500)}`);
    }
    if (Array.isArray(mondayJson?.errors) && mondayJson.errors.length) {
      throw new Error(`Monday.com GraphQL error: ${JSON.stringify(mondayJson.errors).slice(0, 500)}`);
    }

    const board = mondayJson?.data?.boards?.[0];
    const columns = Array.isArray(board?.columns) ? board.columns : [];
    return columns
      .map((column: any) => ({
        id: String(column.id || ""),
        title: String(column.title || column.id || ""),
        type: String(column.type || "text"),
      }))
      .filter((column: { id: string }) => column.id);
  }

  const items = await collectMondayBoardItemsViaItemsPage(boardId);
  const byId = new Map<string, { id: string; title: string; type: string }>();
  for (const item of items) {
    for (const column of slimColumnValuesForApi(item)) {
      if (column.id && !byId.has(column.id)) {
        byId.set(column.id, {
          id: column.id,
          title: column.title || column.id,
          type: column.type || "text",
        });
      }
    }
  }
  return Array.from(byId.values()).sort((a, b) => a.title.localeCompare(b.title));
}

async function updateMondayLinkColumn(args: {
  boardId: string;
  itemId: string;
  columnId: string;
  url: string;
  label: string;
}): Promise<boolean> {
  const normalizedUrl = sanitizeMondayLinkUrl(args.url);
  if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
    throw new Error("Link URL must start with http:// or https://");
  }

  const linkObject = { url: normalizedUrl, text: args.label };
  const toolPayload = {
    board_id: args.boardId,
    item_id: args.itemId,
    column_id: args.columnId,
    value: linkObject,
  };

  try {
    const res = await executeMondayTool<any>("MONDAY_UPDATE_ITEM", toolPayload);
    if (res?.successful !== false) {
      console.log("[Monday] Link column updated via MONDAY_UPDATE_ITEM");
      return true;
    }
    console.warn("[Monday] MONDAY_UPDATE_ITEM unsuccessful:", res?.error);
  } catch (e) {
    console.warn("[Monday] MONDAY_UPDATE_ITEM failed:", e);
  }

  try {
    const result = await executeMondayGraphqlDirect({
      query: `
        mutation ($boardId: ID!, $itemId: ID!, $columnValues: JSON!) {
          change_multiple_column_values(
            board_id: $boardId
            item_id: $itemId
            column_values: $columnValues
          ) {
            id
          }
        }
      `,
      variables: {
        boardId: args.boardId,
        itemId: args.itemId,
        columnValues: { [args.columnId]: linkObject },
      },
    });
    if ((result?.data as any)?.change_multiple_column_values?.id) {
      console.log("[Monday] Link column updated via change_multiple_column_values");
      return true;
    }
  } catch (e) {
    console.warn("[Monday] change_multiple_column_values failed:", e);
  }

  try {
    const result = await executeMondayGraphqlDirect({
      query: `
        mutation ($boardId: ID!, $itemId: ID!, $columnId: String!, $value: JSON!) {
          change_column_value(
            board_id: $boardId
            item_id: $itemId
            column_id: $columnId
            value: $value
          ) {
            id
          }
        }
      `,
      variables: {
        boardId: args.boardId,
        itemId: args.itemId,
        columnId: args.columnId,
        value: linkObject,
      },
    });
    if ((result?.data as any)?.change_column_value?.id) {
      console.log("[Monday] Link column updated via change_column_value");
      return true;
    }
  } catch (e) {
    console.warn("[Monday] change_column_value failed:", e);
  }

  return false;
}

export async function linkMondayReport(args: {
  itemId: string;
  reportType: "CIM" | "Teaser";
  fileUrl: string;
}) {
  const globalBoardId = await getStoredMondayBoardId().catch(() => null);
  const globalMapping = await getStoredMondayColumnMapping().catch(() => null);

  const mappingKey = getMondayLinkColumnKey(args.reportType);
  const columnId: string | null = globalMapping?.[mappingKey] ?? null;

  console.log(
    `[Monday] linkMondayReport — reportType: ${args.reportType}, itemId: ${args.itemId}, columnId: ${columnId}, boardId: ${globalBoardId}`
  );

  if (columnId && globalBoardId && args.itemId && !args.itemId.startsWith("temp")) {
    const columnUpdated = await updateMondayLinkColumn({
      boardId: globalBoardId,
      itemId: args.itemId,
      columnId,
      url: args.fileUrl,
      label: `View ${args.reportType}`,
    });

    if (!columnUpdated) {
      throw new Error(
        `Failed to save the ${args.reportType} link to Monday.com. Reconnect Monday.com in Admin Settings and confirm the mapped column is a Link column.`
      );
    }
  } else {
    throw new Error(
      `Monday.com link column is not configured for ${args.reportType}. Map the ${mappingKey} column in Admin Settings.`
    );
  }

  return { success: true };
}
