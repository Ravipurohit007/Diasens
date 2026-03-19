const Groq = require("groq-sdk");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { question, summary } = req.body || {};
  if (!question) return res.status(400).json({ error: "Missing question" });

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `You are a support analytics assistant for GoodFlip / TatvaCare's CGM (Continuous Glucose Monitor) support team.
You analyze Freshdesk ticket data and provide concise, actionable insights.
Be specific with numbers. Use bullet points where helpful. Keep responses under 200 words.`
        },
        {
          role: "user",
          content: `Here is the current CGM Tech ticket data:\n\n${JSON.stringify(summary, null, 2)}\n\nQuestion: ${question}`
        }
      ]
    });

    const answer = completion.choices[0]?.message?.content || "No response";
    return res.status(200).json({ answer });
  } catch (err) {
    console.error("Groq error:", err);
    return res.status(500).json({ error: err.message || "Unknown error" });
  }
};
