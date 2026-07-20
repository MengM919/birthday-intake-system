import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json"
};
const tianApiUrl = "https://apis.tianapi.com/star/index";
const juheUrl = "https://v.juhe.cn/laohuangli/d";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });

  try {
    const body = await request.json().catch(() => ({}));
    const birthday = String(body.birthday || "");
    if (!validBirthday(birthday)) throw new Error("请提供有效的生日日期。");

    const date = validDate(body.date) ? String(body.date) : chinaToday();
    const zodiac = zodiacFor(birthday);
    const service = serviceClient();

    const [horoscopeResult, almanacResult] = await Promise.all([
      readSource(() => cached(service, date, "horoscope", zodiac, () => loadHoroscope(zodiac, date))),
      readSource(() => cached(service, date, "almanac", "all", () => loadAlmanac(date)))
    ]);

    if (!horoscopeResult.value && !almanacResult.value) {
      throw new Error("今日好运暂时在路上，请稍后再来看看。");
    }

    const updatedAt = [horoscopeResult.value, almanacResult.value]
      .map((item) => String(item?.source_updated_at || ""))
      .filter(Boolean)
      .sort()
      .pop() || new Date().toISOString();

    return json({
      ok: true,
      date,
      zodiac,
      horoscope: horoscopeResult.value?.payload || null,
      almanac: almanacResult.value?.payload || null,
      sources: {
        horoscope: horoscopeResult.value?.source_name || null,
        almanac: almanacResult.value?.source_name || null
      },
      unavailable: {
        horoscope: horoscopeResult.error || null,
        almanac: almanacResult.error || null
      },
      updatedAt,
      disclaimer: "仅供娱乐参考"
    });
  } catch (error) {
    return json({ ok: false, unavailable: true, error: message(error) }, 503);
  }
});

function serviceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("今日好运服务暂时不可用，请稍后再试。");
  return createClient(url, key);
}

async function readSource(loader: () => Promise<any>) {
  try {
    return { value: await loader(), error: null };
  } catch (error) {
    console.warn("Daily luck source failed:", error);
    return { value: null, error: "暂时不可用" };
  }
}

async function cached(
  service: any,
  date: string,
  kind: "horoscope" | "almanac",
  zodiac: string,
  loader: () => Promise<Record<string, unknown>>
) {
  const { data: cache, error } = await service
    .from("daily_luck_cache")
    .select("payload, source_name, source_updated_at, expires_at")
    .eq("cache_date", date)
    .eq("kind", kind)
    .eq("zodiac", zodiac)
    .maybeSingle();

  if (error) throw new Error("今日好运服务暂时不可用，请稍后再试。");
  if (cache && new Date(cache.expires_at).getTime() > Date.now() && cacheIsUsable(kind, cache.payload)) return cache;

  const payload = await loader();
  const sourceName = kind === "horoscope" ? "TianAPI" : "Juhe";
  const expiresAt = tomorrowInChina();
  const updatedAt = new Date().toISOString();
  const { data: saved, error: saveError } = await service
    .from("daily_luck_cache")
    .upsert({
      cache_date: date,
      kind,
      zodiac,
      payload,
      source_name: sourceName,
      source_updated_at: updatedAt,
      expires_at: expiresAt
    }, { onConflict: "cache_date,kind,zodiac" })
    .select("payload, source_name, source_updated_at, expires_at")
    .single();

  if (saveError || !saved) throw new Error("今日好运服务暂时不可用，请稍后再试。");
  return saved;
}

async function loadHoroscope(zodiac: string, date: string) {
  const key = Deno.env.get("TIANAPI_KEY");
  if (!key) throw new Error("今日好运服务暂时不可用，请稍后再试。");

  const url = new URL(Deno.env.get("TIANAPI_STAR_URL") || tianApiUrl);
  url.searchParams.set("key", key);
  url.searchParams.set("astro", zodiac);
  url.searchParams.set("date", date);

  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("今日好运服务暂时不可用，请稍后再试。");

  const raw = await response.json();
  if (Number(raw.code) !== 200 || !raw.result) throw new Error("今日好运服务暂时不可用，请稍后再试。");
  const normalized = normalizeHoroscope(raw.result, zodiac, date);
  if (!normalized.summary) throw new Error("星座服务没有返回可展示的内容。");
  return normalized;
}

function cacheIsUsable(kind: "horoscope" | "almanac", payload: unknown) {
  if (kind !== "horoscope") return true;
  const value = asRecord(payload);
  return Boolean(textValue(value.summary) || textValue(value.content));
}

function normalizeHoroscope(rawResult: unknown, zodiac: string, date: string) {
  const root = asRecord(rawResult);
  const records = horoscopeRecords(rawResult);
  const primary = records.find((record) => Boolean(contentOf(record))) || root;
  const summary = contentOf(primary) || contentOf(root) || typedContent(records, ["今日", "概述", "综合", "总运", "运势"]);

  return {
    astro: firstText(primary, ["astro", "constellation", "star"]) || zodiac,
    date,
    type: firstText(primary, ["type", "title", "name", "label"]) || "今日星象",
    summary,
    love: firstText(primary, ["love", "love_index", "loveIndex"]) || typedContent(records, ["爱情", "感情"]),
    work: firstText(primary, ["work", "career", "work_index", "workIndex"]) || typedContent(records, ["工作", "事业"]),
    money: firstText(primary, ["money", "wealth", "money_index", "moneyIndex"]) || typedContent(records, ["财运", "财富"]),
    health: firstText(primary, ["health", "health_index", "healthIndex"]) || typedContent(records, ["健康"]),
    luckyColor: firstText(primary, ["luckycolor", "lucky_color", "color", "luckyColor"]) || typedContent(records, ["幸运色", "颜色"]),
    luckyNumber: firstText(primary, ["number", "luckynumber", "lucky_number", "luckyNumber"]) || typedContent(records, ["幸运数字", "数字"])
  };
}

function horoscopeRecords(value: unknown) {
  if (Array.isArray(value)) return value.map(asRecord).filter(hasValues);
  const root = asRecord(value);
  for (const key of ["list", "items", "data", "results"]) {
    if (Array.isArray(root[key])) return (root[key] as unknown[]).map(asRecord).filter(hasValues);
  }
  return hasValues(root) ? [root] : [];
}

function typedContent(records: Record<string, unknown>[], terms: string[]) {
  for (const record of records) {
    const type = firstText(record, ["type", "title", "name", "label"]);
    if (terms.some((term) => type.includes(term))) {
      const content = contentOf(record);
      if (content) return content;
    }
  }
  return "";
}

function contentOf(record: Record<string, unknown>) {
  return firstText(record, ["summary", "content", "all", "description", "desc", "text", "value"]);
}

function firstText(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = textValue(record[key]);
    if (value) return value;
  }
  return "";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function hasValues(value: Record<string, unknown>) {
  return Object.keys(value).length > 0;
}

function textValue(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}
async function loadAlmanac(date: string) {
  const key = Deno.env.get("JUHE_ALMANAC_KEY");
  if (!key) throw new Error("今日好运服务暂时不可用，请稍后再试。");

  const url = new URL(Deno.env.get("JUHE_ALMANAC_URL") || juheUrl);
  url.searchParams.set("key", key);
  url.searchParams.set("date", date);

  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("今日好运服务暂时不可用，请稍后再试。");

  const raw = await response.json();
  if (Number(raw.error_code) !== 0 || !raw.result) throw new Error("今日好运服务暂时不可用，请稍后再试。");
  const result = raw.result;

  return {
    date,
    lunar: String(result.yinli || result.lunar || ""),
    suitable: String(result.yi || ""),
    avoid: String(result.ji || ""),
    luckyGod: String(result.xishen || ""),
    wealthGod: String(result.caishen || "")
  };
}

function zodiacFor(value: string) {
  const date = new Date(value + "T12:00:00");
  const month = date.getMonth() + 1;
  const day = date.getDate();
  if ((month === 1 && day < 20) || (month === 12 && day >= 22)) return "capricorn";
  if ((month === 1 && day >= 20) || (month === 2 && day < 19)) return "aquarius";
  if ((month === 2 && day >= 19) || (month === 3 && day < 21)) return "pisces";
  if ((month === 3 && day >= 21) || (month === 4 && day < 20)) return "aries";
  if ((month === 4 && day >= 20) || (month === 5 && day < 21)) return "taurus";
  if ((month === 5 && day >= 21) || (month === 6 && day < 22)) return "gemini";
  if ((month === 6 && day >= 22) || (month === 7 && day < 23)) return "cancer";
  if ((month === 7 && day >= 23) || (month === 8 && day < 23)) return "leo";
  if ((month === 8 && day >= 23) || (month === 9 && day < 23)) return "virgo";
  if ((month === 9 && day >= 23) || (month === 10 && day < 24)) return "libra";
  if ((month === 10 && day >= 24) || (month === 11 && day < 23)) return "scorpio";
  return "sagittarius";
}

function chinaToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return value.year + "-" + value.month + "-" + value.day;
}

function tomorrowInChina() {
  const tomorrow = new Date(Date.now() + 1000 * 60 * 60 * 36);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(tomorrow);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return new Date(value.year + "-" + value.month + "-" + value.day + "T23:59:59+08:00").toISOString();
}

function validDate(value: unknown) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) &&
    !Number.isNaN(new Date(String(value) + "T12:00:00").getTime());
}

function validBirthday(value: string) {
  return validDate(value) && new Date(value + "T12:00:00").getTime() < Date.now();
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "今日好运服务暂时不可用，请稍后再试。";
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers });
}