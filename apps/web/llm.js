/* =====================================================================
   LLM — the tutor's optional AI provider. OFF by default.
   With provider = null, no AI service is ever called and no API tokens
   are used: the built-in rule-based tutor answers from the simulator.

   To add one later (for example Gemini), set LLM.provider to
     async (prompt, { tools, signal, onText }) => ({ text })
   and have it call YOUR OWN server endpoint (e.g. POST /v1/tutor), which
   holds the API key. Never put an API key in this file or anywhere in
   apps/web: everything here is shipped to every visitor's browser.
===================================================================== */
const LLM = { provider: null };
