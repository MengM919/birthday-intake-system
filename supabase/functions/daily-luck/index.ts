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
  if (cache && new Date(cache.expires_at).getTime() > Date.now()) return cache;

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
  const result = raw.result;

  return {
    astro: String(result.astro || zodiac),
    date,
    summary: String(result.summary || result.content || result.all || ""),
    love: String(result.love || result.love_index || result.loveIndex || ""),
    work: String(result.work || result.career || result.work_index || result.workIndex || ""),
    money: String(result.money || result.wealth || result.money_index || result.moneyIndex || ""),
    health: String(result.health || result.health_index || result.healthIndex || ""),
    luckyColor: String(result.luckycolor || result.lucky_color || result.color || result.luckyColor || ""),
    luckyNumber: String(result.number || result.luckynumber || result.lucky_number || result.luckyNumber || "")
  };
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