import type { EditorSummaryItem } from "@/components/synthesis/EditorView";
import { DOCTRINE_LABELS } from "@/config/doctrineConfig";
import { filterOutTombstoned, unTombstoneEntity } from "@/lib/syncEngine";

export const LOCAL_SUMMARIES_KEY = "hippocampus_clean_summaries_v2";
export const LEGACY_SUMMARIES_KEY = "hippocampus_clean_summaries";
const COMPATIBILITY_SUMMARY_KEYS = [
  "hippocampus_local_summaries_v2",
  "hippocampus_clean_summaries_v4",
];
const ALL_SUMMARY_KEYS = [
  LOCAL_SUMMARIES_KEY,
  LEGACY_SUMMARIES_KEY,
  ...COMPATIBILITY_SUMMARY_KEYS,
];

export function getLocalSummaries(): EditorSummaryItem[] {
  try {
    const itemMap = new Map<string, EditorSummaryItem>();
    for (const key of ALL_SUMMARY_KEYS) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) continue;
        for (const item of parsed) {
          if (!item?.id || itemMap.has(String(item.id))) continue;
          itemMap.set(String(item.id), {
            id: String(item.id),
            title: String(item.title || "Synthèse sans titre"),
            subject: String(item.subject || item.discipline || "Médecine"),
            updatedAt: String(item.updatedAt || "Aujourd'hui"),
            wordCount: Number(item.wordCount) || 100,
            doctrineLabel: String(item.doctrineLabel || DOCTRINE_LABELS.objectives_verbatim),
            htmlContent: String(item.htmlContent || item.content || ""),
          });
        }
      } catch {
        // ignore
      }
    }
    if (itemMap.size > 0) {
      return filterOutTombstoned("summary", Array.from(itemMap.values()));
    }
  } catch {
    // ignore
  }
  return [];
}

export function saveLocalSummaries(items: EditorSummaryItem[]) {
  try {
    for (const item of items) {
      if (item && (item.id || item.title)) {
        unTombstoneEntity("summary", item.id, item.title);
      }
    }
    const serialized = JSON.stringify(items);
    for (const key of ALL_SUMMARY_KEYS) {
      localStorage.setItem(key, serialized);
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("dawjang_summaries_updated"));
    }
  } catch {
    // ignore
  }
}
