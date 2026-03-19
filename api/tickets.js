const fetch = require("node-fetch");

const DOMAIN = process.env.FRESHDESK_DOMAIN; // e.g. tatvacare-help.freshdesk.com
const API_KEY = process.env.FRESHDESK_API_KEY;

async function fetchAllTickets(since) {
  let page = 1;
  let all = [];

  while (true) {
    const url = `https://${DOMAIN}/api/v2/tickets?updated_since=${since}&per_page=100&page=${page}&include=stats`;
    const res = await fetch(url, {
      headers: {
        Authorization: "Basic " + Buffer.from(`${API_KEY}:X`).toString("base64"),
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Freshdesk API error ${res.status}: ${err}`);
    }

    const tickets = await res.json();
    if (!tickets.length) break;
    all = all.concat(tickets);
    if (tickets.length < 100) break;
    page++;
  }

  return all;
}

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { from } = req.query;
    if (!from) {
      return res.status(400).json({ error: "Missing 'from' query param (ISO date)" });
    }

    const all = await fetchAllTickets(from);

    // Filter to CGM Issue tickets created on/after the from date
    const cgm = all.filter((t) => {
      const cf = t.custom_fields || {};
      const isCGM = cf.cf_level_1357202 === "CGM Issue";
      const created = t.created_at && t.created_at >= from;
      return isCGM && created;
    });

    // Shape the response
    const tickets = cgm.map((t) => ({
      id: t.id,
      subject: t.subject,
      status: t.status,
      created_at: t.created_at,
      updated_at: t.updated_at,
      due_by: t.due_by,
      responder_id: t.responder_id,
      tags: t.tags || [],
      level1: t.custom_fields?.cf_level_1357202 || null,
      level2: t.custom_fields?.cf_level_2111837 || null,
      level3: t.custom_fields?.cf_level_3941749 || null,
      mobile: t.custom_fields?.cf_registered_mobile_number || null,
      type: t.type,
      resolved_at: t.stats?.resolved_at || null,
    }));

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate"); // 5-min cache
    return res.status(200).json({ tickets, total: tickets.length });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
