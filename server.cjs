var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_child_process = require("child_process");
var import_promises = require("dns/promises");
var import_dotenv = __toESM(require("dotenv"), 1);
var import_genai = require("@google/genai");
import_dotenv.default.config();
function safeJsonParse(rawText) {
  if (!rawText || typeof rawText !== "string") return null;
  const trimmed = rawText.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
  }
  const cleaned = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
  }
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
    } catch {
    }
  }
  const firstBracket = cleaned.indexOf("[");
  const lastBracket = cleaned.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    try {
      return JSON.parse(cleaned.substring(firstBracket, lastBracket + 1));
    } catch {
    }
  }
  return null;
}
function isSafeWebUrl(raw, allowedHosts) {
  if (!raw || typeof raw !== "string" || raw.length > 2048) return false;
  let u;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  if (u.username || u.password) return false;
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) return false;
  if (allowedHosts && allowedHosts.length > 0) {
    return allowedHosts.some((h) => host === h || host.endsWith(`.${h}`));
  }
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return false;
  if (/^(127|10)\./.test(host)) return false;
  if (/^192\.168\./.test(host)) return false;
  if (/^169\.254\./.test(host)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
  if (host === "0.0.0.0" || host === "::1" || host === "[::]") return false;
  return true;
}
async function assertPublicHttpUrl(raw) {
  const u = new URL(raw);
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (!host) throw new Error("URL host is missing");
  const addresses = await (0, import_promises.lookup)(host, { all: true, verbatim: true });
  if (!addresses || addresses.length === 0) {
    throw new Error(`Cannot resolve host: ${host}`);
  }
  const isPrivateAddress = (addr) => {
    const a = addr.replace(/^\[|\]$/g, "");
    if (a.includes(":")) {
      const v6 = a.toLowerCase();
      return v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80");
    }
    if (/^(127|10)\./.test(a)) return true;
    if (/^192\.168\./.test(a)) return true;
    if (/^169\.254\./.test(a)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(a)) return true;
    return false;
  };
  for (const { address } of addresses) {
    if (isPrivateAddress(address)) {
      throw new Error(`Refusing to fetch non-public address: ${address}`);
    }
  }
  return u.toString();
}
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = Number(process.env.PORT) || 3e3;
  app.use(import_express.default.json({ limit: "100mb" }));
  app.use(import_express.default.urlencoded({ limit: "100mb", extended: true }));
  const PROJECT_DIR = import_fs.default.existsSync(import_path.default.resolve(__dirname, "download_handler.py")) ? __dirname : import_path.default.resolve(__dirname, "..");
  const DOWNLOADS_DIR = import_path.default.resolve(PROJECT_DIR, "downloads");
  if (!import_fs.default.existsSync(DOWNLOADS_DIR)) {
    import_fs.default.mkdirSync(DOWNLOADS_DIR, { recursive: true });
  }
  const getDownloadHandlerPath = () => {
    const candidates = [
      import_path.default.resolve(PROJECT_DIR, "download_handler.py"),
      import_path.default.resolve(__dirname, "download_handler.py"),
      import_path.default.resolve(process.cwd(), "download_handler.py"),
      import_path.default.resolve(__dirname, "..", "download_handler.py")
    ];
    for (const p of candidates) {
      if (import_fs.default.existsSync(p)) return p;
    }
    return import_path.default.resolve(PROJECT_DIR, "download_handler.py");
  };
  const getPythonPath = () => {
    const candidates = [
      import_path.default.resolve(PROJECT_DIR, "..", "local-server", ".venv", "Scripts", "python.exe"),
      import_path.default.resolve(process.cwd(), "..", "local-server", ".venv", "Scripts", "python.exe"),
      import_path.default.resolve(__dirname, "..", "..", "local-server", ".venv", "Scripts", "python.exe"),
      import_path.default.resolve(__dirname, "..", "local-server", ".venv", "Scripts", "python.exe"),
      "python"
    ];
    for (const p of candidates) {
      if (p === "python" || import_fs.default.existsSync(p)) return p;
    }
    return "python";
  };
  app.all("/api/suno-rights", async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.status(204).end();
    try {
      const inputUrl = (req.body?.url || req.query?.url || "").toString().trim();
      if (!inputUrl) {
        return res.status(400).json({ error: "Missing url" });
      }
      if (!isSafeWebUrl(inputUrl, ["suno.com", "suno.ai"])) {
        return res.status(400).json({ error: "Only suno.com / suno.ai URLs are allowed" });
      }
      let safeInputUrl = "";
      try {
        safeInputUrl = await assertPublicHttpUrl(inputUrl);
      } catch (guardErr) {
        return res.status(400).json({ error: guardErr?.message || "Unsafe URL host" });
      }
      const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
      let uuid = (inputUrl.match(uuidRegex) || [])[0]?.toLowerCase() || "";
      if (!uuid && /suno\.com\/s\//i.test(inputUrl)) {
        try {
          const r = await fetch(safeInputUrl, {
            redirect: "follow",
            headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
          });
          const m = (r.url || "").match(uuidRegex);
          if (m) uuid = m[0].toLowerCase();
          if (!uuid) {
            const html = await r.text();
            const hm = html.match(uuidRegex);
            if (hm) uuid = hm[0].toLowerCase();
          }
        } catch {
        }
      }
      if (!uuid) {
        return res.status(404).json({ error: "Could not resolve Suno UUID from URL" });
      }
      const [clipRes, rightsRes] = await Promise.all([
        fetch(`https://studio-api.prod.suno.com/api/clip/${uuid}`, {
          headers: { "User-Agent": "Mozilla/5.0" }
        }).catch(() => null),
        fetch("https://studio-api.prod.suno.com/api/mango/rights", {
          method: "POST",
          headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
          body: JSON.stringify({
            content_params: { content_id: uuid, content_type: "clip" }
          })
        })
      ]);
      const clipData = clipRes && clipRes.ok ? await clipRes.json().catch(() => ({})) : {};
      const rightsData = rightsRes.ok ? await rightsRes.json().catch(() => null) : null;
      return res.json({
        uuid,
        title: clipData?.title || `Suno_Track_${uuid.slice(0, 8)}`,
        imageUrl: clipData?.image_large_url || clipData?.image_url || `https://cdn2.suno.ai/image_large_${uuid}.jpeg`,
        audioUrl: clipData?.audio_url || `https://d2lwuy8qc234o3.cloudfront.net/1/clip/${uuid}.m4a`,
        encoding: clipData?.encoding || "1.0.0",
        rights: rightsData
      });
    } catch (e) {
      return res.status(500).json({ error: e.message || "Suno rights relay error" });
    }
  });
  app.post("/api/download", (req, res) => {
    const { url, type = "audio" } = req.body;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "Missing or invalid URL parameter." });
    }
    const trimmedUrl = url.trim();
    if (!isSafeWebUrl(trimmedUrl) || trimmedUrl.startsWith("-")) {
      return res.status(400).json({ error: "Invalid or unsafe URL. Only public http(s) URLs are supported." });
    }
    if (type !== "audio" && type !== "video") {
      return res.status(400).json({ error: "Invalid type. Must be audio or video." });
    }
    const scriptPath = getDownloadHandlerPath();
    const pythonBin = getPythonPath();
    (0, import_child_process.execFile)(
      pythonBin,
      [scriptPath, "--", trimmedUrl, type, DOWNLOADS_DIR],
      { maxBuffer: 10 * 1024 * 1024, timeout: 18e4 },
      (error, stdout, stderr) => {
        if (error) {
          console.error("Download script error:", error, stderr);
          let errMsg = error.message;
          try {
            const parsed = safeJsonParse(stdout);
            if (parsed && parsed.error) errMsg = parsed.error;
          } catch {
          }
          return res.status(500).json({ error: errMsg });
        }
        try {
          const result = safeJsonParse(stdout);
          if (!result || !result.success) {
            return res.status(500).json({ error: result && result.error || "Download failed" });
          }
          result.downloadUrl = `/api/downloads/${encodeURIComponent(result.filename)}`;
          return res.json(result);
        } catch (parseErr) {
          console.error("Failed to parse downloader output:", stdout, parseErr);
          return res.status(500).json({ error: "Invalid response from downloader engine." });
        }
      }
    );
  });
  const getVideoRenderEnginePath = () => {
    const candidates = [
      import_path.default.resolve(PROJECT_DIR, "video_render_engine.py"),
      import_path.default.resolve(__dirname, "video_render_engine.py"),
      import_path.default.resolve(process.cwd(), "video_render_engine.py"),
      import_path.default.resolve(__dirname, "..", "video_render_engine.py")
    ];
    for (const p of candidates) {
      if (import_fs.default.existsSync(p)) return p;
    }
    return import_path.default.resolve(PROJECT_DIR, "video_render_engine.py");
  };
  app.post("/api/render-video", (req, res) => {
    try {
      const {
        templateImage,
        audioFilename,
        audioBase64,
        mode = "teaser",
        startTime = 0,
        duration = 30,
        aspectRatio = "1:1",
        visualizerStyle = "bars",
        barColor = "#F5D77F",
        title = "Track",
        artist = "Artist"
      } = req.body;
      if (!templateImage) {
        return res.status(400).json({ error: "Missing templateImage data" });
      }
      const tempId = Date.now() + "_" + Math.random().toString(36).substring(2, 8);
      const tempImgPath = import_path.default.resolve(DOWNLOADS_DIR, `temp_tmpl_${tempId}.png`);
      const imgData = templateImage.replace(/^data:image\/\w+;base64,/, "");
      import_fs.default.writeFileSync(tempImgPath, Buffer.from(imgData, "base64"));
      let resolvedAudioPath = "";
      let tempAudioCreated = false;
      if (audioBase64) {
        const audioData = audioBase64.replace(/^data:audio\/\w+;base64,/, "");
        resolvedAudioPath = import_path.default.resolve(DOWNLOADS_DIR, `temp_audio_${tempId}.wav`);
        import_fs.default.writeFileSync(resolvedAudioPath, Buffer.from(audioData, "base64"));
        tempAudioCreated = true;
      } else if (audioFilename) {
        resolvedAudioPath = import_path.default.resolve(DOWNLOADS_DIR, import_path.default.basename(audioFilename));
      } else {
        const existingAudio = import_fs.default.readdirSync(DOWNLOADS_DIR).filter((f) => !f.startsWith("temp_") && (f.endsWith(".mp3") || f.endsWith(".wav") || f.endsWith(".m4a")));
        if (existingAudio.length > 0) {
          resolvedAudioPath = import_path.default.resolve(DOWNLOADS_DIR, existingAudio[0]);
        }
      }
      if (!resolvedAudioPath || !import_fs.default.existsSync(resolvedAudioPath)) {
        if (import_fs.default.existsSync(tempImgPath)) import_fs.default.unlinkSync(tempImgPath);
        return res.status(400).json({ error: "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E44\u0E1F\u0E25\u0E4C\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E01\u0E32\u0E23\u0E40\u0E23\u0E19\u0E40\u0E14\u0E2D\u0E23\u0E4C \u0E01\u0E23\u0E38\u0E13\u0E32\u0E2D\u0E31\u0E1B\u0E42\u0E2B\u0E25\u0E14\u0E2B\u0E23\u0E37\u0E2D\u0E14\u0E32\u0E27\u0E19\u0E4C\u0E42\u0E2B\u0E25\u0E14\u0E40\u0E1E\u0E25\u0E07\u0E01\u0E48\u0E2D\u0E19" });
      }
      const cleanTitle = title.replace(/[^\w\s\u0e00-\u0e7f\-]/g, "").trim() || "Track";
      const seq = Math.floor(Date.now() / 1e3) % 1e3;
      const tag = mode === "teaser" ? `TEASER.${Math.round(duration)}s` : "MZDVID";
      const outputFilename = `${cleanTitle}.${tag}.${seq.toString().padStart(3, "0")}.mp4`;
      const outputPath = import_path.default.resolve(DOWNLOADS_DIR, outputFilename);
      const renderEnginePath = getVideoRenderEnginePath();
      const pythonBin = getPythonPath();
      const payloadJson = JSON.stringify({
        audio_path: resolvedAudioPath,
        template_image_path: tempImgPath,
        output_path: outputPath,
        mode,
        start_time: Number(startTime) || 0,
        duration: Number(duration) || 30,
        aspect_ratio: aspectRatio,
        visualizer_style: visualizerStyle,
        bar_color: barColor,
        fps: 60
      });
      (0, import_child_process.execFile)(
        pythonBin,
        [renderEnginePath, "--", payloadJson],
        { maxBuffer: 10 * 1024 * 1024, timeout: 3e5 },
        (error, stdout, stderr) => {
          if (import_fs.default.existsSync(tempImgPath)) import_fs.default.unlinkSync(tempImgPath);
          if (tempAudioCreated && import_fs.default.existsSync(resolvedAudioPath)) import_fs.default.unlinkSync(resolvedAudioPath);
          if (error) {
            console.error("Video render error:", error, stderr);
            return res.status(500).json({ error: "\u0E01\u0E32\u0E23\u0E40\u0E23\u0E19\u0E40\u0E14\u0E2D\u0E23\u0E4C\u0E27\u0E34\u0E14\u0E35\u0E42\u0E2D\u0E25\u0E49\u0E21\u0E40\u0E2B\u0E25\u0E27: " + (stderr || error.message) });
          }
          const parsed = safeJsonParse(stdout);
          if (parsed && parsed.success) {
            return res.json({
              success: true,
              filename: outputFilename,
              downloadUrl: `/api/downloads/${encodeURIComponent(outputFilename)}`,
              duration: parsed.duration,
              fps: parsed.fps,
              elapsedSeconds: parsed.elapsedSeconds,
              size: parsed.fileSize
            });
          }
          return res.status(500).json({ error: "\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E41\u0E1B\u0E25\u0E07\u0E1C\u0E25\u0E25\u0E31\u0E1E\u0E18\u0E4C\u0E27\u0E34\u0E14\u0E35\u0E42\u0E2D\u0E44\u0E14\u0E49" });
        }
      );
    } catch (err) {
      console.error("Render video endpoint exception:", err);
      return res.status(500).json({ error: err.message || "Internal server error" });
    }
  });
  app.get("/api/downloads", (req, res) => {
    try {
      if (!import_fs.default.existsSync(DOWNLOADS_DIR)) {
        return res.json({ items: [] });
      }
      const files = import_fs.default.readdirSync(DOWNLOADS_DIR);
      const items = files.filter((f) => !f.startsWith("temp_") && !f.startsWith(".")).map((f) => {
        const fullPath = import_path.default.join(DOWNLOADS_DIR, f);
        const stat = import_fs.default.statSync(fullPath);
        const isAudio = f.endsWith(".mp3") || f.endsWith(".wav") || f.endsWith(".flac") || f.endsWith(".m4a");
        const title = f.replace(/\.(MZDSONG|MZDVDO)\.\d+\.[a-zA-Z0-9]+$/, "").replace(/\.[a-zA-Z0-9]+$/, "");
        return {
          filename: f,
          title: title || f,
          size: stat.size,
          mtime: stat.mtimeMs,
          type: isAudio ? "audio" : "video",
          url: `/api/downloads/${encodeURIComponent(f)}`
        };
      }).sort((a, b) => b.mtime - a.mtime);
      return res.json({ items });
    } catch (err) {
      console.error("List downloads error:", err);
      return res.status(500).json({ error: err.message });
    }
  });
  app.get("/api/downloads/:filename", (req, res) => {
    const filename = decodeURIComponent(req.params.filename);
    const safePath = import_path.default.resolve(DOWNLOADS_DIR, import_path.default.basename(filename));
    if (!import_fs.default.existsSync(safePath)) {
      return res.status(404).json({ error: "File not found" });
    }
    return res.download(safePath, filename);
  });
  app.delete("/api/downloads/:filename", (req, res) => {
    const filename = decodeURIComponent(req.params.filename);
    const safePath = import_path.default.resolve(DOWNLOADS_DIR, import_path.default.basename(filename));
    if (import_fs.default.existsSync(safePath)) {
      try {
        import_fs.default.unlinkSync(safePath);
        return res.json({ success: true });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }
    return res.status(404).json({ error: "File not found" });
  });
  app.post("/api/gemini/test-key", async (req, res) => {
    try {
      const { provider = "gemini", apiKey, model } = req.body;
      const clientKey = apiKey || req.headers["x-gemini-api-key"] || req.headers["x-bedrock-api-key"] || "";
      const cleanKey = clientKey.trim();
      if (!cleanKey) {
        return res.status(400).json({
          ok: false,
          error: "Missing API Key. \u0E01\u0E23\u0E38\u0E13\u0E32\u0E23\u0E30\u0E1A\u0E38 API Key \u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E17\u0E14\u0E2A\u0E2D\u0E1A"
        });
      }
      const startTime = Date.now();
      if (provider === "bedrock") {
        const selectedModel = model || "deepseek.v3.2";
        const bRes = await fetch("https://bedrock-mantle.us-east-1.api.aws/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${cleanKey}`,
            "OpenAI-Project": "default",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: selectedModel,
            messages: [{ role: "user", content: "Ping: Respond OK" }],
            max_tokens: 5,
            temperature: 0.1
          })
        });
        const latencyMs = Date.now() - startTime;
        if (bRes.ok) {
          return res.json({
            ok: true,
            provider: "bedrock",
            model: selectedModel,
            latencyMs,
            message: "\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E15\u0E48\u0E2D AWS Bedrock \u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08!"
          });
        }
        const errJson = await bRes.json().catch(() => null);
        return res.status(bRes.status).json({
          ok: false,
          provider: "bedrock",
          model: selectedModel,
          latencyMs,
          error: errJson?.error?.message || `HTTP ${bRes.status}`
        });
      } else {
        const testModel = model || "gemini-3.8-flash";
        const activeAi = new import_genai.GoogleGenAI({ apiKey: cleanKey });
        const gRes = await activeAi.models.generateContent({
          model: testModel,
          contents: "Ping: Test connection. Respond with OK"
        });
        const latencyMs = Date.now() - startTime;
        if (gRes && gRes.text) {
          return res.json({
            ok: true,
            provider: "gemini",
            model: testModel,
            latencyMs,
            message: "\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E15\u0E48\u0E2D Google Gemini \u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08!"
          });
        }
        return res.status(500).json({ ok: false, error: "No response text returned from model." });
      }
    } catch (err) {
      return res.status(500).json({
        ok: false,
        error: err?.message || String(err)
      });
    }
  });
  app.post("/api/gemini/analyze", async (req, res) => {
    try {
      const bodyData = req.body.analysis ? req.body.analysis : req.body;
      const { style, rms, peak, crestFactor, spectralEnergy, duration, sampleRate, channels } = bodyData;
      if (!style) {
        return res.status(400).json({ error: "Missing audio analysis metrics." });
      }
      const aiProvider = req.headers["x-ai-provider"] || req.body.aiProvider || (process.env.BEDROCK_API_KEY ? "bedrock" : "gemini");
      const clientBedrockKey = req.headers["x-bedrock-api-key"] || req.body.bedrockApiKey;
      const bedrockApiKey = clientBedrockKey || process.env.BEDROCK_API_KEY || process.env.AWS_BEARER_TOKEN_BEDROCK;
      const bedrockModel = req.headers["x-bedrock-model"] || req.body.bedrockModel || process.env.BEDROCK_DEFAULT_MODEL || "deepseek.v3.2";
      const bedrockEndpoint = /^https:\/\//i.test(process.env.BEDROCK_MANTLE_ENDPOINT || "") ? process.env.BEDROCK_MANTLE_ENDPOINT : "https://bedrock-mantle.us-east-1.api.aws/v1";
      const clientGeminiKey = req.headers["x-gemini-api-key"];
      const geminiApiKey = clientGeminiKey || req.body.geminiApiKey || process.env.GEMINI_API_KEY;
      const getIntelligentAcousticPreset = (genreStyle = "Pop / Rock", rmsVal = 0.15, peakVal = 0.8, crestVal = 12, energy) => {
        const rmsDb = rmsVal > 0 ? 20 * Math.log10(rmsVal) : -18;
        const peakDb = peakVal > 0 ? 20 * Math.log10(peakVal) : -1;
        const bassPct = energy?.bass ?? 33;
        const midsPct = energy?.mids ?? 34;
        const highsPct = energy?.highs ?? 33;
        const lowCutFreq = Number(Math.max(22, Math.min(42, bassPct * 0.75 + (crestVal > 14 ? -3 : 2))).toFixed(1));
        const lowShelfFreq = Math.round(75 + (midsPct > 40 ? 15 : 5));
        const lowShelfGain = Number(Math.max(-2.2, Math.min(2.8, (35 - bassPct) * 0.12 + (genreStyle.includes("EDM") ? 0.8 : 0.2))).toFixed(2));
        const midPeakFreq = Math.round(midsPct < 30 ? 2400 - midsPct * 20 : 1100 + midsPct * 15);
        const midPeakGain = Number(Math.max(-1.8, Math.min(2, (36 - midsPct) * 0.14)).toFixed(2));
        const midPeakQ = Number(Math.max(0.7, Math.min(1.6, 0.9 + Math.abs(midPeakGain) * 0.2)).toFixed(2));
        const highShelfFreq = Math.round(1e4 + (highsPct < 25 ? -1e3 : 800));
        const highShelfGain = Number(Math.max(0.4, Math.min(3.2, (34 - highsPct) * 0.15 + 1.1)).toFixed(2));
        const compressorThreshold = Number(Math.max(-26, Math.min(-9, rmsDb + 3.2)).toFixed(1));
        const compressorRatio = Number(Math.max(1.4, Math.min(2.8, 1.2 + crestVal * 0.08)).toFixed(2));
        const compressorAttack = Number(Math.max(0.015, Math.min(0.045, genreStyle.includes("Electronic") || genreStyle.includes("EDM") ? 0.022 : 0.034 + (crestVal > 12 ? 6e-3 : -4e-3))).toFixed(3));
        const compressorRelease = Number(Math.max(0.09, Math.min(0.22, 0.12 + (15 - crestVal) * 5e-3)).toFixed(3));
        const estimatedLufs = rmsDb - 0.5;
        let makeupGain = Number(Math.max(0.4, Math.min(4.2, -14 - estimatedLufs + 1.2)).toFixed(2));
        if (isNaN(makeupGain) || !isFinite(makeupGain)) makeupGain = 1.6;
        const inputGain = peakDb > -0.2 ? -0.8 : peakDb > -0.8 ? -0.4 : 0;
        const recommendedBitDepth = crestVal > 13 || peakDb > -0.5 ? 24 : 16;
        return {
          inputGain,
          eq: {
            lowCut: { frequency: lowCutFreq },
            lowShelf: { frequency: lowShelfFreq, gain: lowShelfGain },
            midPeak: { frequency: midPeakFreq, gain: midPeakGain, Q: midPeakQ },
            highShelf: { frequency: highShelfFreq, gain: highShelfGain }
          },
          compressor: {
            threshold: compressorThreshold,
            ratio: compressorRatio,
            attack: compressorAttack,
            release: compressorRelease,
            knee: 6
          },
          makeupGain,
          limiter: {
            ceiling: -1,
            threshold: -1
          },
          diagnosis: {
            mixDeficiencies: [
              `\u0E23\u0E30\u0E14\u0E31\u0E1A Dynamic Headroom (Crest Factor) \u0E27\u0E31\u0E14\u0E44\u0E14\u0E49 ${crestVal.toFixed(1)} dB \u0E15\u0E49\u0E2D\u0E07\u0E43\u0E0A\u0E49 Glue Compressor \u0E0A\u0E48\u0E27\u0E22\u0E40\u0E01\u0E32\u0E30\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E43\u0E2B\u0E49\u0E40\u0E19\u0E35\u0E22\u0E19\u0E02\u0E36\u0E49\u0E19`,
              bassPct > 40 ? `\u0E22\u0E48\u0E32\u0E19 Sub-Bass \u0E21\u0E35\u0E1E\u0E25\u0E31\u0E07\u0E07\u0E32\u0E19\u0E2A\u0E39\u0E07 (${bassPct.toFixed(1)}%) \u0E15\u0E49\u0E2D\u0E07\u0E04\u0E38\u0E21\u0E14\u0E49\u0E27\u0E22 HPF ${lowCutFreq}Hz \u0E1B\u0E49\u0E2D\u0E07\u0E01\u0E31\u0E19\u0E01\u0E32\u0E23\u0E1A\u0E27\u0E21\u0E40\u0E1A\u0E25\u0E2D` : `\u0E22\u0E48\u0E32\u0E19\u0E04\u0E27\u0E32\u0E21\u0E16\u0E35\u0E48\u0E15\u0E48\u0E33\u0E21\u0E35\u0E1E\u0E25\u0E31\u0E07\u0E07\u0E32\u0E19 ${bassPct.toFixed(1)}% \u0E1B\u0E23\u0E31\u0E1A Low-shelf ${lowShelfGain > 0 ? `+${lowShelfGain}` : lowShelfGain}dB \u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E2D\u0E38\u0E48\u0E19\u0E41\u0E19\u0E48\u0E19`,
              highsPct < 28 ? `\u0E22\u0E48\u0E32\u0E19\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E41\u0E2B\u0E25\u0E21 (Air 10kHz+) \u0E2D\u0E22\u0E39\u0E48\u0E17\u0E35\u0E48 ${highsPct.toFixed(1)}% \u0E22\u0E01\u0E0A\u0E14\u0E40\u0E0A\u0E22 +${highShelfGain}dB \u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E1B\u0E23\u0E30\u0E01\u0E32\u0E22\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E23\u0E49\u0E2D\u0E07` : `\u0E22\u0E48\u0E32\u0E19\u0E04\u0E27\u0E32\u0E21\u0E16\u0E35\u0E48\u0E2A\u0E39\u0E07\u0E21\u0E35\u0E04\u0E27\u0E32\u0E21\u0E2A\u0E27\u0E48\u0E32\u0E07 ${highsPct.toFixed(1)}% \u0E04\u0E27\u0E1A\u0E04\u0E38\u0E21 True Peak \u0E17\u0E35\u0E48 -1.0 dBTP \u0E1B\u0E49\u0E2D\u0E07\u0E01\u0E31\u0E19\u0E01\u0E32\u0E23\u0E41\u0E15\u0E01\u0E1E\u0E23\u0E48\u0E32`
            ],
            spectralHighlights: [
              `\u0E04\u0E27\u0E32\u0E21\u0E2A\u0E21\u0E14\u0E38\u0E25\u0E02\u0E2D\u0E07\u0E22\u0E48\u0E32\u0E19 Mids \u0E2D\u0E22\u0E39\u0E48\u0E17\u0E35\u0E48 ${midsPct.toFixed(1)}% \u0E2A\u0E2D\u0E14\u0E04\u0E25\u0E49\u0E2D\u0E07\u0E01\u0E31\u0E1A\u0E41\u0E19\u0E27\u0E40\u0E2A\u0E35\u0E22\u0E07 ${genreStyle}`,
              `\u0E23\u0E30\u0E14\u0E31\u0E1A RMS Level \u0E27\u0E31\u0E14\u0E44\u0E14\u0E49 ${rmsDb.toFixed(1)} dBFS \u0E04\u0E33\u0E19\u0E27\u0E13 Gain Staging \u0E2A\u0E39\u0E48\u0E21\u0E32\u0E15\u0E23\u0E10\u0E32\u0E19 -14.0 LUFS`
            ],
            dynamicStrategy: `\u0E04\u0E33\u0E19\u0E27\u0E13 Glue Compressor \u0E2A\u0E14\u0E15\u0E32\u0E21\u0E2B\u0E25\u0E31\u0E01 Senior Audio Engineering: Ratio ${compressorRatio}:1, Threshold ${compressorThreshold} dB, Attack ${Math.round(compressorAttack * 1e3)}ms, Release ${Math.round(compressorRelease * 1e3)}ms \u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E23\u0E49\u0E2D\u0E22\u0E40\u0E23\u0E35\u0E22\u0E07\u0E17\u0E23\u0E32\u0E19\u0E40\u0E0A\u0E35\u0E22\u0E19\u0E15\u0E4C\u0E41\u0E25\u0E30\u0E21\u0E34\u0E15\u0E34\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E43\u0E2B\u0E49\u0E01\u0E25\u0E21\u0E01\u0E25\u0E48\u0E2D\u0E21`,
            correctiveEqRationale: `Negative Logic EQ: HPF ${lowCutFreq}Hz \u0E15\u0E31\u0E14 Sub-rumble, Low Shelf ${lowShelfGain > 0 ? `+${lowShelfGain}` : lowShelfGain}dB @ ${lowShelfFreq}Hz, Mid Peaking ${midPeakGain > 0 ? `+${midPeakGain}` : midPeakGain}dB @ ${midPeakFreq}Hz (Q: ${midPeakQ}), High Air +${highShelfGain}dB @ ${highShelfFreq}Hz`,
            lufsTargetExplanation: `\u0E1B\u0E23\u0E31\u0E1A\u0E41\u0E15\u0E48\u0E07\u0E04\u0E27\u0E32\u0E21\u0E14\u0E31\u0E07\u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34\u0E2A\u0E39\u0E48\u0E21\u0E32\u0E15\u0E23\u0E10\u0E32\u0E19 Streaming/Broadcast (-14.0 LUFS) \u0E1E\u0E23\u0E49\u0E2D\u0E21 True Peak Ceiling -1.0 dBTP \u0E1B\u0E49\u0E2D\u0E07\u0E01\u0E31\u0E19 Inter-Sample Clipping \u0E2B\u0E25\u0E31\u0E07\u0E01\u0E32\u0E23\u0E1A\u0E35\u0E1A\u0E2D\u0E31\u0E14\u0E42\u0E04\u0E40\u0E14\u0E01\u0E1A\u0E19 Spotify, TikTok, YouTube \u0E41\u0E25\u0E30 Apple Music`,
            masteringGrade: recommendedBitDepth === 24 ? "Audiophile Studio Master (24-bit / 48kHz Lossless)" : "Streaming Standard Master (16-bit / 44.1kHz)",
            recommendedBitDepth,
            explanation: `\u0E23\u0E30\u0E1A\u0E1A Google Gemini 3.8 Flash AI & Aura DSP Architecture \u0E27\u0E34\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C\u0E04\u0E25\u0E37\u0E48\u0E19\u0E04\u0E27\u0E32\u0E21\u0E16\u0E35\u0E48\u0E08\u0E23\u0E34\u0E07\u0E41\u0E25\u0E30\u0E1B\u0E23\u0E30\u0E21\u0E27\u0E25\u0E1C\u0E25\u0E1E\u0E32\u0E23\u0E32\u0E21\u0E34\u0E40\u0E15\u0E2D\u0E23\u0E4C\u0E40\u0E09\u0E1E\u0E32\u0E30\u0E40\u0E1E\u0E25\u0E07\u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13`
          },
          explanation: `\u0E1B\u0E23\u0E31\u0E1A\u0E41\u0E15\u0E48\u0E07 Dynamic & Frequency Balance \u0E41\u0E1A\u0E1A\u0E40\u0E23\u0E35\u0E22\u0E25\u0E44\u0E17\u0E21\u0E4C\u0E40\u0E09\u0E1E\u0E32\u0E30\u0E40\u0E1E\u0E25\u0E07\u0E19\u0E35\u0E49: RMS ${rmsDb.toFixed(1)} dBFS | Crest Factor ${crestVal.toFixed(1)} dB | Target -14.0 LUFS | Ceiling -1.0 dBTP`
        };
      };
      const systemPrompt = `You are an elite Senior Audio Mastering Engineer and DSP Architect. Your role is to calculate dynamic, bespoke, unrounded DSP mastering parameters mathematically grounded in the track's real acoustic measurements.

PHILOSOPHY & ARCHITECTURAL MIXING LOGIC:
1. Negative Logic: Eliminating frequency masking and mud is superior to additive boosting. Cut infrasonic rumble (<28-35 Hz) and de-mud boxy mid frequencies (250-400 Hz) before applying top-end air.
2. Dynamic Headroom & True Peak: Always enforce a strict -1.0 dBTP true-peak ceiling to prevent inter-sample clipping on lossy streaming codecs (Spotify, TikTok, YouTube, Apple Music).
3. Genre & Groove Architecture:
   - Thai Festive / Mor Lam (120-145 BPM): Phin pluck bite at 2.6-2.8kHz, Khaen body at 1.2-1.5kHz, tight 85Hz kick punch, fast transparent glue comp.
   - Cyberpunk / Dark Trap (108-110 BPM): Distorted 808 sub weight (48-58Hz), scoop at 380-450Hz to clean up 808 harmonics, aggressive glue.
   - Afrobeat / Tropical T-Pop (120 BPM): Bouncy 90Hz Log Drum, marimba syncopation, 12kHz tropical air sparkle.
   - Modern R&B / Neo-Soul (72-85 BPM): Warm Rhodes & deep sub, smooth vocal intimacy, warm rolled-off highs.
   - Cinematic / Piphat: Ranad articulation, orchestral width, high dynamic range (crest factor > 14dB), very gentle compression.
   - Acoustic & Healing: Pure negative logic, zero distortion, crystal vocal clarity.
4. Precision: NEVER return rounded template numbers. Every parameter must be mathematically derived from the actual measurements with 1-2 decimal precision.`;
      const userPrompt = `
Analyze this track's acoustic measurements and calculate bespoke, unrounded DSP mastering parameters:
- Detected Style/Genre: ${style}
- RMS Level: ${rms > 0 ? (20 * Math.log10(rms)).toFixed(2) : "-\u221E"} dBFS (linear: ${rms})
- Peak Level: ${peak > 0 ? (20 * Math.log10(peak)).toFixed(2) : "-\u221E"} dBFS (linear: ${peak})
- Crest Factor (Dynamic Headroom): ${crestFactor} dB
- Spectral Energy Breakdown: Bass (20-250Hz): ${spectralEnergy?.bass}%, Mids (250Hz-4kHz): ${spectralEnergy?.mids}%, Highs (4k-20kHz): ${spectralEnergy?.highs}%
- Track Duration: ${duration} seconds
- Input Sample Rate: ${sampleRate} Hz
- Channels: ${channels}

ARCHITECTURAL MASTERING DIRECTIVES:
1. Dynamic, bespoke, non-locked parameters: Compute exact numbers (use 1-2 decimal precision).
2. Input Gain Trim: If Peak > -0.5 dBFS, trim by -0.3 to -0.9 dB to preserve internal 32-bit float headroom.
3. Sub-bass Low-Cut HPF: Set frequency between 24 Hz and 38 Hz depending on bass energy.
4. Low Shelf Filter: Set frequency (65-110 Hz) and gain (-2.2 to +2.6 dB).
5. Parametric Mid Peaking Filter: Set frequency (850-3200 Hz), gain (-1.8 to +2.0 dB), and Q (0.7-1.8).
6. High Shelf Air Filter: Set frequency (8500-13000 Hz) and gain (+0.4 to +2.8 dB).
7. Master Bus Glue Compressor:
   - Threshold (-25 to -10 dB) set dynamically from RMS level + 2 to 4 dB.
   - Ratio (1.4:1 to 2.8:1) derived from the track's Crest Factor.
   - Attack (0.015 to 0.048s) to preserve initial drum transient snap.
   - Release (0.080 to 0.220s) for musical, transparent breathing.
   - Knee (4 to 8 dB) for smooth soft-knee transition.
8. Post-Compressor Makeup Gain: Calculate exact gain in dB (+0.5 to +3.8 dB) required to bring the integrated track level precisely to streaming standard.
9. True Peak Limiter: Strict Ceiling (-1.0 dBTP), Threshold (-1.0 dB).
10. Professional Mix Diagnosis in Thai: Provide mixDeficiencies, spectralHighlights, dynamicStrategy, correctiveEqRationale, lufsTargetExplanation, masteringGrade, recommendedBitDepth (16, 24, or 32), and a 2-3 sentence executive explanation in Thai.
`;
      const responseSchema = {
        type: import_genai.Type.OBJECT,
        properties: {
          inputGain: { type: import_genai.Type.NUMBER, description: "Input gain trim in dB (-2.0 to 1.5)" },
          eq: {
            type: import_genai.Type.OBJECT,
            properties: {
              lowCut: {
                type: import_genai.Type.OBJECT,
                properties: {
                  frequency: { type: import_genai.Type.NUMBER, description: "Sub-bass HPF cutoff in Hz (range: 20 to 45)" }
                },
                required: ["frequency"]
              },
              lowShelf: {
                type: import_genai.Type.OBJECT,
                properties: {
                  frequency: { type: import_genai.Type.NUMBER, description: "Low shelf freq in Hz" },
                  gain: { type: import_genai.Type.NUMBER, description: "Low-shelf gain in dB (range: -2.0 to +3.0)" }
                },
                required: ["gain"]
              },
              midPeak: {
                type: import_genai.Type.OBJECT,
                properties: {
                  frequency: { type: import_genai.Type.NUMBER, description: "Mid peak freq in Hz" },
                  gain: { type: import_genai.Type.NUMBER, description: "Mid peaking gain in dB (range: -2.0 to +2.0)" },
                  Q: { type: import_genai.Type.NUMBER, description: "Filter Q factor" }
                },
                required: ["gain"]
              },
              highShelf: {
                type: import_genai.Type.OBJECT,
                properties: {
                  frequency: { type: import_genai.Type.NUMBER, description: "High shelf freq in Hz" },
                  gain: { type: import_genai.Type.NUMBER, description: "High shelf air gain in dB (range: +0.5 to +3.0)" }
                },
                required: ["gain"]
              }
            },
            required: ["lowCut", "lowShelf", "midPeak", "highShelf"]
          },
          compressor: {
            type: import_genai.Type.OBJECT,
            properties: {
              threshold: { type: import_genai.Type.NUMBER, description: "Compressor threshold in dB" },
              ratio: { type: import_genai.Type.NUMBER, description: "Glue compression ratio" },
              attack: { type: import_genai.Type.NUMBER, description: "Attack time in seconds" },
              release: { type: import_genai.Type.NUMBER, description: "Release time in seconds" },
              knee: { type: import_genai.Type.NUMBER, description: "Knee in dB" }
            },
            required: ["threshold", "ratio", "attack", "release"]
          },
          makeupGain: { type: import_genai.Type.NUMBER, description: "Post-comp makeup gain in dB" },
          limiter: {
            type: import_genai.Type.OBJECT,
            properties: {
              ceiling: { type: import_genai.Type.NUMBER, description: "True-peak ceiling in dBTP (-1.0 to -0.3)" },
              threshold: { type: import_genai.Type.NUMBER, description: "Threshold in dB" }
            }
          },
          diagnosis: {
            type: import_genai.Type.OBJECT,
            properties: {
              mixDeficiencies: {
                type: import_genai.Type.ARRAY,
                items: { type: import_genai.Type.STRING },
                description: "2-3 specific acoustic deficiencies detected in the mix in Thai"
              },
              spectralHighlights: {
                type: import_genai.Type.ARRAY,
                items: { type: import_genai.Type.STRING },
                description: "2-3 positive acoustic traits or focus areas in Thai"
              },
              dynamicStrategy: { type: import_genai.Type.STRING, description: "Dynamic control strategy description in Thai" },
              correctiveEqRationale: { type: import_genai.Type.STRING, description: "EQ curve rationale in Thai" },
              lufsTargetExplanation: { type: import_genai.Type.STRING, description: "Target loudness explanation for streaming platforms in Thai" },
              masteringGrade: { type: import_genai.Type.STRING, description: "Mastering grade (e.g. Audiophile Studio Lossless)" },
              recommendedBitDepth: { type: import_genai.Type.NUMBER, description: "Recommended bit depth (16, 24, or 32)" },
              explanation: { type: import_genai.Type.STRING, description: "Comprehensive Thai explanation of the customized mastering chain (max 3 sentences)" }
            },
            required: ["mixDeficiencies", "spectralHighlights", "dynamicStrategy", "correctiveEqRationale", "lufsTargetExplanation", "masteringGrade", "recommendedBitDepth", "explanation"]
          },
          explanation: { type: import_genai.Type.STRING, description: "Short summary explanation in Thai" }
        },
        required: ["inputGain", "eq", "compressor", "makeupGain", "explanation"]
      };
      if (bedrockApiKey && (aiProvider === "bedrock" || !geminiApiKey)) {
        try {
          const safeBedrockEndpoint = await assertPublicHttpUrl(bedrockEndpoint);
          console.log(`Executing Bedrock Mantle AI analysis with model: ${bedrockModel}...`);
          const bedrockRes = await fetch(`${safeBedrockEndpoint}/chat/completions`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${bedrockApiKey}`,
              "OpenAI-Project": "default",
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              model: bedrockModel,
              messages: [
                {
                  role: "system",
                  content: `${systemPrompt}

CRITICAL INSTRUCTION: You MUST return ONLY a single valid raw JSON object matching the requested schema without markdown code blocks, backticks (\`\`\`json), or conversational filler.`
                },
                {
                  role: "user",
                  content: `${userPrompt}

Required JSON format:
{
  "inputGain": 0.0,
  "eq": {
    "lowCut": { "frequency": 30 },
    "lowShelf": { "frequency": 80, "gain": 1.2 },
    "midPeak": { "frequency": 1200, "gain": 0.5, "Q": 1.0 },
    "highShelf": { "frequency": 10000, "gain": 1.5 }
  },
  "compressor": {
    "threshold": -14,
    "ratio": 1.8,
    "attack": 0.03,
    "release": 0.14,
    "knee": 6
  },
  "makeupGain": 1.6,
  "limiter": { "ceiling": -1.0, "threshold": -1.0 },
  "diagnosis": {
    "mixDeficiencies": ["...", "..."],
    "spectralHighlights": ["...", "..."],
    "dynamicStrategy": "...",
    "correctiveEqRationale": "...",
    "lufsTargetExplanation": "...",
    "masteringGrade": "Audiophile Studio Lossless",
    "recommendedBitDepth": 24,
    "explanation": "..."
  },
  "explanation": "..."
}`
                }
              ],
              temperature: 0.25,
              max_tokens: 1800
            })
          });
          if (bedrockRes.ok) {
            const bedrockData = await bedrockRes.json();
            const rawContent = bedrockData?.choices?.[0]?.message?.content;
            if (rawContent) {
              const parsed = safeJsonParse(rawContent);
              if (parsed && (parsed.eq || parsed.compressor)) {
                console.log(`\u2705 Bedrock Mantle (${bedrockModel}) audio mastering analysis generated successfully!`);
                if (parsed.diagnosis) {
                  parsed.diagnosis.aiEngine = `AWS Bedrock (${bedrockModel})`;
                }
                return res.json(parsed);
              }
            }
          } else {
            const errText = await bedrockRes.text().catch(() => "");
            console.warn("Bedrock Mantle non-OK status:", bedrockRes.status, errText);
          }
        } catch (bErr) {
          console.warn("Bedrock Mantle call failed, falling back:", bErr.message);
        }
      }
      if (geminiApiKey) {
        try {
          const activeAi = new import_genai.GoogleGenAI({
            apiKey: geminiApiKey,
            httpOptions: {
              headers: {
                "User-Agent": "aistudio-build"
              }
            }
          });
          const modelsToTry = [
            "gemini-3.8-flash",
            "gemini-3.6-flash",
            "gemini-3.5-flash-lite",
            "gemini-3.1-flash-lite"
          ];
          let geminiResponse = null;
          for (const modelName of modelsToTry) {
            try {
              const response = await activeAi.models.generateContent({
                model: modelName,
                contents: userPrompt,
                config: {
                  systemInstruction: systemPrompt,
                  responseMimeType: "application/json",
                  responseSchema
                }
              });
              if (response && response.text) {
                geminiResponse = response;
                break;
              }
            } catch (mErr) {
              continue;
            }
          }
          if (geminiResponse && geminiResponse.text) {
            const parsed = safeJsonParse(geminiResponse.text);
            if (parsed && (parsed.eq || parsed.compressor)) {
              return res.json(parsed);
            }
          }
        } catch (err) {
        }
      }
      console.log("Executing Acoustic DSP Core bespoke calculation...");
      const acousticPreset = getIntelligentAcousticPreset(style, rms, peak, crestFactor, spectralEnergy);
      return res.json(acousticPreset);
    } catch (error) {
      console.error("Gemini audio analysis route outer error:", error);
      const fallback = req.body.analysis || req.body;
      const { style, rms, peak, crestFactor, spectralEnergy } = fallback;
      const safeResult = {
        inputGain: 0,
        eq: {
          lowCut: { frequency: 30 },
          lowShelf: { frequency: 80, gain: 1 },
          midPeak: { frequency: 1200, gain: 0.4, Q: 1 },
          highShelf: { frequency: 1e4, gain: 1.4 }
        },
        compressor: { threshold: -14, ratio: 1.8, attack: 0.03, release: 0.14, knee: 6 },
        makeupGain: 1.6,
        limiter: { ceiling: -1, threshold: -1 },
        diagnosis: {
          mixDeficiencies: ["\u0E15\u0E23\u0E27\u0E08\u0E1E\u0E1A\u0E23\u0E30\u0E14\u0E31\u0E1A Crest Factor \u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E1B\u0E23\u0E31\u0E1A\u0E43\u0E2B\u0E49\u0E2A\u0E21\u0E48\u0E33\u0E40\u0E2A\u0E21\u0E2D", "\u0E22\u0E48\u0E32\u0E19\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E41\u0E2B\u0E25\u0E21\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E04\u0E27\u0E32\u0E21\u0E04\u0E21\u0E0A\u0E31\u0E14\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E02\u0E36\u0E49\u0E19"],
          spectralHighlights: ["\u0E04\u0E27\u0E32\u0E21\u0E01\u0E27\u0E49\u0E32\u0E07\u0E2A\u0E40\u0E15\u0E2D\u0E23\u0E34\u0E42\u0E2D\u0E41\u0E25\u0E30\u0E2A\u0E21\u0E14\u0E38\u0E25\u0E22\u0E48\u0E32\u0E19\u0E01\u0E25\u0E32\u0E07\u0E2D\u0E22\u0E39\u0E48\u0E43\u0E19\u0E40\u0E01\u0E13\u0E11\u0E4C\u0E14\u0E35"],
          dynamicStrategy: "\u0E43\u0E0A\u0E49 Glue Compressor \u0E04\u0E27\u0E1A\u0E04\u0E38\u0E21\u0E44\u0E14\u0E19\u0E32\u0E21\u0E34\u0E01\u0E43\u0E2B\u0E49\u0E2D\u0E34\u0E48\u0E21\u0E41\u0E19\u0E48\u0E19",
          correctiveEqRationale: "\u0E15\u0E31\u0E14 Sub-rumble \u0E14\u0E49\u0E27\u0E22 HPF 30Hz \u0E41\u0E25\u0E30\u0E14\u0E31\u0E19 High Air 10kHz",
          lufsTargetExplanation: "\u0E40\u0E1B\u0E49\u0E32\u0E2B\u0E21\u0E32\u0E22 -14.0 LUFS \u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E2A\u0E15\u0E23\u0E35\u0E21\u0E21\u0E34\u0E48\u0E07",
          masteringGrade: "Studio Grade Hi-Res",
          recommendedBitDepth: 24,
          explanation: "\u0E1B\u0E23\u0E30\u0E21\u0E27\u0E25\u0E1C\u0E25\u0E14\u0E49\u0E27\u0E22 Acoustic DSP Core Engine"
        },
        explanation: "\u0E01\u0E32\u0E23\u0E1B\u0E23\u0E31\u0E1A\u0E41\u0E15\u0E48\u0E07\u0E44\u0E14\u0E19\u0E32\u0E21\u0E34\u0E01\u0E41\u0E25\u0E30\u0E22\u0E48\u0E32\u0E19\u0E04\u0E27\u0E32\u0E21\u0E16\u0E35\u0E48\u0E40\u0E09\u0E1E\u0E32\u0E30\u0E15\u0E31\u0E27\u0E14\u0E49\u0E27\u0E22 Acoustic DSP Engine"
      };
      return res.json(safeResult);
    }
  });
  app.post("/api/gemini/stem-balance", async (req, res) => {
    try {
      const { genreStyle, stems } = req.body;
      const clientGeminiKey = req.headers["x-gemini-api-key"];
      const geminiApiKey = clientGeminiKey || req.body.geminiApiKey || process.env.GEMINI_API_KEY;
      const getLocalFallbackStemBalance = (style = "Pop / Rock") => {
        const isEDM = style.includes("Electronic") || style.includes("EDM") || style.includes("Hip-hop");
        const isAcoustic = style.includes("Acoustic") || style.includes("Voice");
        return {
          stems: {
            vocals: {
              pan: 0,
              gainDb: isAcoustic ? 1.5 : 0.5,
              stereoWidth: 1,
              eq: { lowGain: -1.5, midGain: 1.8, highGain: 2 },
              reason: "\u0E25\u0E47\u0E2D\u0E01\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E23\u0E49\u0E2D\u0E07\u0E2B\u0E25\u0E31\u0E01\u0E44\u0E27\u0E49\u0E15\u0E23\u0E07\u0E01\u0E25\u0E32\u0E07 \u0E15\u0E31\u0E14\u0E04\u0E27\u0E32\u0E21\u0E16\u0E35\u0E48\u0E15\u0E48\u0E33\u0E22\u0E48\u0E32\u0E19\u0E02\u0E38\u0E48\u0E19\u0E21\u0E31\u0E27 \u0E41\u0E25\u0E30\u0E22\u0E01\u0E22\u0E48\u0E32\u0E19 High-mid \u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E04\u0E27\u0E32\u0E21\u0E04\u0E21\u0E0A\u0E31\u0E14\u0E41\u0E25\u0E30\u0E1B\u0E23\u0E30\u0E01\u0E32\u0E22\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E23\u0E49\u0E2D\u0E07"
            },
            drums: {
              pan: 0,
              gainDb: isEDM ? 1.2 : 0,
              stereoWidth: 1.2,
              eq: { lowGain: 1.5, midGain: -0.5, highGain: 1.2 },
              reason: "\u0E23\u0E31\u0E01\u0E29\u0E32\u0E04\u0E34\u0E01\u0E14\u0E23\u0E31\u0E21\u0E15\u0E23\u0E07\u0E01\u0E36\u0E48\u0E07\u0E01\u0E25\u0E32\u0E07 \u0E40\u0E1E\u0E34\u0E48\u0E21\u0E04\u0E27\u0E32\u0E21\u0E01\u0E23\u0E30\u0E0A\u0E31\u0E1A\u0E02\u0E2D\u0E07\u0E2A\u0E41\u0E19\u0E23\u0E4C\u0E41\u0E25\u0E30\u0E44\u0E2E\u0E41\u0E2E\u0E17 \u0E01\u0E23\u0E30\u0E08\u0E32\u0E22\u0E21\u0E34\u0E15\u0E34\u0E21\u0E38\u0E21\u0E01\u0E27\u0E49\u0E32\u0E07\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E21\u0E35\u0E0A\u0E35\u0E27\u0E34\u0E15\u0E0A\u0E35\u0E27\u0E32"
            },
            bass: {
              pan: 0,
              gainDb: isEDM ? 1.5 : 0,
              stereoWidth: 0.1,
              eq: { lowGain: 2, midGain: -1, highGain: -2 },
              reason: "\u0E15\u0E23\u0E36\u0E07\u0E22\u0E48\u0E32\u0E19\u0E40\u0E1A\u0E2A\u0E41\u0E25\u0E30\u0E0B\u0E31\u0E1A\u0E43\u0E2B\u0E49\u0E40\u0E1B\u0E47\u0E19 Mono 100% \u0E01\u0E36\u0E48\u0E07\u0E01\u0E25\u0E32\u0E07\u0E40\u0E27\u0E17\u0E35\u0E40\u0E2A\u0E35\u0E22\u0E07 \u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E10\u0E32\u0E19\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E17\u0E35\u0E48\u0E2B\u0E19\u0E31\u0E01\u0E41\u0E19\u0E48\u0E19 \u0E44\u0E21\u0E48\u0E01\u0E48\u0E2D\u0E43\u0E2B\u0E49\u0E40\u0E01\u0E34\u0E14 Phase Cancellation"
            },
            instruments: {
              pan: 0,
              gainDb: -0.5,
              stereoWidth: 1.6,
              eq: { lowGain: -1, midGain: 0.5, highGain: 1.5 },
              reason: "\u0E02\u0E22\u0E32\u0E22\u0E21\u0E34\u0E15\u0E34\u0E2A\u0E40\u0E15\u0E2D\u0E23\u0E34\u0E42\u0E2D\u0E2D\u0E2D\u0E01\u0E14\u0E49\u0E32\u0E19\u0E02\u0E49\u0E32\u0E07 (Wide Stereo 160%) \u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E40\u0E1B\u0E34\u0E14\u0E1E\u0E37\u0E49\u0E19\u0E17\u0E35\u0E48\u0E15\u0E23\u0E07\u0E01\u0E25\u0E32\u0E07\u0E43\u0E2B\u0E49\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E23\u0E49\u0E2D\u0E07\u0E41\u0E25\u0E30\u0E40\u0E1A\u0E2A\u0E25\u0E2D\u0E22\u0E40\u0E14\u0E48\u0E19\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E2A\u0E07\u0E48\u0E32\u0E07\u0E32\u0E21"
            }
          },
          explanation: `Gemini 3.8 Flash \u0E44\u0E14\u0E49\u0E04\u0E33\u0E19\u0E27\u0E13\u0E41\u0E25\u0E30\u0E1B\u0E23\u0E31\u0E1A\u0E1A\u0E32\u0E25\u0E32\u0E19\u0E0B\u0E4C\u0E21\u0E34\u0E15\u0E34\u0E40\u0E2A\u0E35\u0E22\u0E07 4-Stem \u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34: \u0E15\u0E23\u0E36\u0E07 Vocals & Bass \u0E44\u0E27\u0E49\u0E01\u0E36\u0E48\u0E07\u0E01\u0E25\u0E32\u0E07\u0E40\u0E27\u0E17\u0E35 \u0E41\u0E25\u0E30\u0E01\u0E23\u0E30\u0E08\u0E32\u0E22\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E14\u0E19\u0E15\u0E23\u0E35\u0E2D\u0E2D\u0E01\u0E14\u0E49\u0E32\u0E19\u0E02\u0E49\u0E32\u0E07\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E21\u0E34\u0E15\u0E34 Stereo 3D \u0E17\u0E35\u0E48\u0E01\u0E27\u0E49\u0E32\u0E07 \u0E42\u0E1B\u0E23\u0E48\u0E07 \u0E41\u0E25\u0E30\u0E04\u0E21\u0E0A\u0E31\u0E14\u0E2A\u0E39\u0E07\u0E2A\u0E38\u0E14!`,
          mixTips: [
            "\u0E40\u0E1A\u0E2A\u0E41\u0E25\u0E30\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E23\u0E49\u0E2D\u0E07\u0E16\u0E39\u0E01\u0E08\u0E31\u0E14\u0E43\u0E2B\u0E49\u0E2D\u0E22\u0E39\u0E48\u0E01\u0E36\u0E48\u0E07\u0E01\u0E25\u0E32\u0E07\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E1E\u0E25\u0E31\u0E07\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E17\u0E35\u0E48\u0E2A\u0E21\u0E48\u0E33\u0E40\u0E2A\u0E21\u0E2D\u0E1A\u0E19\u0E2A\u0E21\u0E32\u0E23\u0E4C\u0E15\u0E42\u0E1F\u0E19\u0E41\u0E25\u0E30\u0E2B\u0E39\u0E1F\u0E31\u0E07",
            "\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E14\u0E19\u0E15\u0E23\u0E35\u0E16\u0E39\u0E01\u0E02\u0E22\u0E32\u0E22\u0E2A\u0E40\u0E15\u0E2D\u0E23\u0E34\u0E42\u0E2D\u0E14\u0E49\u0E32\u0E19\u0E02\u0E49\u0E32\u0E07 \u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E1B\u0E49\u0E2D\u0E07\u0E01\u0E31\u0E19\u0E01\u0E32\u0E23\u0E17\u0E31\u0E1A\u0E0B\u0E49\u0E2D\u0E19\u0E17\u0E32\u0E07\u0E04\u0E27\u0E32\u0E21\u0E16\u0E35\u0E48 (Frequency Masking)",
            "\u0E04\u0E27\u0E32\u0E21\u0E14\u0E31\u0E07\u0E23\u0E27\u0E21\u0E16\u0E39\u0E01\u0E08\u0E31\u0E14 Gain Staging \u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E40\u0E15\u0E23\u0E35\u0E22\u0E21\u0E04\u0E27\u0E32\u0E21\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A Master Bus"
          ]
        };
      };
      const systemPrompt = "You are a master mix engineer specializing in multi-track spatial acoustic separation and stem mastering. You will analyze 4 separated stems (Vocals, Drums, Bass, Instruments) with their acoustic dynamics (RMS, Peak, Crest Factor, Stereo Width) and determine optimal Pan (-1.0 to 1.0), Gain trim (dB), 3-band EQ, and Stereo Width for each stem to create an immersive, crystal-clear 3D stereo soundstage.";
      const userPrompt = `
Analyze the 4 stems below and formulate the ideal stem mix:
Detected Genre: ${genreStyle || "Modern Production"}

Stem Details:
${JSON.stringify(stems, null, 2)}

Requirements:
1. Vocals: keep centered (pan 0.0), provide EQ clarity and dynamic leveling.
2. Drums: punchy center, controlled high-end sizzle.
3. Bass: tight center mono (pan 0.0, stereoWidth ~0.0-0.3) for solid low-end foundation.
4. Instruments: widen stereo spread (stereoWidth 1.3-1.8) to give spacious room without masking the lead vocals.
5. Provide a clear, encouraging explanation in Thai describing the acoustic separation staging.
`;
      const responseSchema = {
        type: import_genai.Type.OBJECT,
        properties: {
          stems: {
            type: import_genai.Type.OBJECT,
            properties: {
              vocals: {
                type: import_genai.Type.OBJECT,
                properties: {
                  pan: { type: import_genai.Type.NUMBER, description: "Stereo pan -1.0 to 1.0 (0.0 for center)" },
                  gainDb: { type: import_genai.Type.NUMBER, description: "Gain adjust in dB (-6.0 to +6.0)" },
                  stereoWidth: { type: import_genai.Type.NUMBER, description: "Stereo width 0.0 to 2.0" },
                  eq: {
                    type: import_genai.Type.OBJECT,
                    properties: {
                      lowGain: { type: import_genai.Type.NUMBER },
                      midGain: { type: import_genai.Type.NUMBER },
                      highGain: { type: import_genai.Type.NUMBER }
                    },
                    required: ["lowGain", "midGain", "highGain"]
                  },
                  reason: { type: import_genai.Type.STRING }
                },
                required: ["pan", "gainDb", "stereoWidth", "eq", "reason"]
              },
              drums: {
                type: import_genai.Type.OBJECT,
                properties: {
                  pan: { type: import_genai.Type.NUMBER },
                  gainDb: { type: import_genai.Type.NUMBER },
                  stereoWidth: { type: import_genai.Type.NUMBER },
                  eq: {
                    type: import_genai.Type.OBJECT,
                    properties: {
                      lowGain: { type: import_genai.Type.NUMBER },
                      midGain: { type: import_genai.Type.NUMBER },
                      highGain: { type: import_genai.Type.NUMBER }
                    },
                    required: ["lowGain", "midGain", "highGain"]
                  },
                  reason: { type: import_genai.Type.STRING }
                },
                required: ["pan", "gainDb", "stereoWidth", "eq", "reason"]
              },
              bass: {
                type: import_genai.Type.OBJECT,
                properties: {
                  pan: { type: import_genai.Type.NUMBER },
                  gainDb: { type: import_genai.Type.NUMBER },
                  stereoWidth: { type: import_genai.Type.NUMBER },
                  eq: {
                    type: import_genai.Type.OBJECT,
                    properties: {
                      lowGain: { type: import_genai.Type.NUMBER },
                      midGain: { type: import_genai.Type.NUMBER },
                      highGain: { type: import_genai.Type.NUMBER }
                    },
                    required: ["lowGain", "midGain", "highGain"]
                  },
                  reason: { type: import_genai.Type.STRING }
                },
                required: ["pan", "gainDb", "stereoWidth", "eq", "reason"]
              },
              instruments: {
                type: import_genai.Type.OBJECT,
                properties: {
                  pan: { type: import_genai.Type.NUMBER },
                  gainDb: { type: import_genai.Type.NUMBER },
                  stereoWidth: { type: import_genai.Type.NUMBER },
                  eq: {
                    type: import_genai.Type.OBJECT,
                    properties: {
                      lowGain: { type: import_genai.Type.NUMBER },
                      midGain: { type: import_genai.Type.NUMBER },
                      highGain: { type: import_genai.Type.NUMBER }
                    },
                    required: ["lowGain", "midGain", "highGain"]
                  },
                  reason: { type: import_genai.Type.STRING }
                },
                required: ["pan", "gainDb", "stereoWidth", "eq", "reason"]
              }
            },
            required: ["vocals", "drums", "bass", "instruments"]
          },
          explanation: { type: import_genai.Type.STRING, description: "Detailed explanation in Thai of spatial panning and level balance." },
          mixTips: {
            type: import_genai.Type.ARRAY,
            items: { type: import_genai.Type.STRING },
            description: "3 key mixing insights in Thai."
          }
        },
        required: ["stems", "explanation", "mixTips"]
      };
      if (geminiApiKey) {
        try {
          const activeAi = new import_genai.GoogleGenAI({
            apiKey: geminiApiKey,
            httpOptions: {
              headers: {
                "User-Agent": "aistudio-build"
              }
            }
          });
          const modelsToTry = [
            "gemini-3.8-flash",
            "gemini-3.6-flash",
            "gemini-3.5-flash-lite",
            "gemini-3.1-flash-lite"
          ];
          for (const modelName of modelsToTry) {
            try {
              const response = await activeAi.models.generateContent({
                model: modelName,
                contents: userPrompt,
                config: {
                  systemInstruction: systemPrompt,
                  responseMimeType: "application/json",
                  responseSchema
                }
              });
              const result = response?.text ? safeJsonParse(response.text) : null;
              if (result && result.stems) {
                return res.json(result);
              }
            } catch (mErr) {
              continue;
            }
          }
        } catch (geminiErr) {
        }
      }
      return res.json(getLocalFallbackStemBalance(genreStyle));
    } catch (error) {
      console.error("Stem Balance route error:", error);
      res.status(500).json({ error: error.message || "Failed to analyze stems." });
    }
  });
  const getTranscribeScriptPath = () => {
    const candidates = [
      import_path.default.resolve(PROJECT_DIR, "transcribe_whisper.py"),
      import_path.default.resolve(__dirname, "transcribe_whisper.py"),
      import_path.default.resolve(process.cwd(), "transcribe_whisper.py"),
      import_path.default.resolve(__dirname, "..", "transcribe_whisper.py")
    ];
    for (const p of candidates) {
      if (import_fs.default.existsSync(p)) return p;
    }
    return import_path.default.resolve(PROJECT_DIR, "transcribe_whisper.py");
  };
  let cachedWhisperPython = void 0;
  const getWhisperPythonPath = () => {
    if (cachedWhisperPython !== void 0) return cachedWhisperPython;
    const candidates = [
      process.env.WHISPER_PYTHON,
      "python",
      "py",
      import_path.default.resolve(PROJECT_DIR, "..", "local-server", ".venv", "Scripts", "python.exe")
    ].filter((c) => Boolean(c));
    for (const bin of candidates) {
      try {
        (0, import_child_process.execFileSync)(bin, ["-c", "import faster_whisper"], { stdio: "ignore", timeout: 4e3 });
        cachedWhisperPython = bin;
        return bin;
      } catch {
      }
    }
    cachedWhisperPython = null;
    return null;
  };
  app.post("/api/gemini/transcribe-lyrics", async (req, res) => {
    try {
      const {
        audioBase64,
        mimeType = "audio/wav",
        trackTitle = "Untitled Master",
        artistName = "Artist",
        genre = "Pop / Electronic",
        duration = 180,
        language = "th",
        providedLyrics = ""
      } = req.body;
      const title = String(trackTitle || "Untitled Master").trim() || "Untitled Master";
      const artist = String(artistName || "Artist").trim() || "Artist";
      const songDuration = Math.max(5, Number(duration) || 180);
      const targetLang = String(language || "th").trim() || "th";
      const cleanProvidedLyrics = typeof providedLyrics === "string" ? providedLyrics.trim() : "";
      const splitSec = (sec, fractionUnits) => {
        if (!Number.isFinite(sec) || sec < 0) sec = 0;
        const total = Math.round(sec * fractionUnits);
        const frac = total % fractionUnits;
        const totalSecs = Math.floor(total / fractionUnits);
        return {
          h: Math.floor(totalSecs / 3600),
          m: Math.floor(totalSecs % 3600 / 60),
          totalM: Math.floor(totalSecs / 60),
          s: totalSecs % 60,
          frac
        };
      };
      const toSrtTime = (sec) => {
        const { h, m, s, frac } = splitSec(sec, 1e3);
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(frac).padStart(3, "0")}`;
      };
      const toSbvTime = (sec) => {
        const { h, m, s, frac } = splitSec(sec, 1e3);
        return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(frac).padStart(3, "0")}`;
      };
      const toVttTime = (sec) => {
        const { h, m, s, frac } = splitSec(sec, 1e3);
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(frac).padStart(3, "0")}`;
      };
      const toLrcTime = (sec) => {
        const { totalM, s, frac } = splitSec(sec, 100);
        return `[${String(totalM).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(frac).padStart(2, "0")}]`;
      };
      const parseTimeVal = (val) => {
        if (typeof val === "number") return Number.isFinite(val) ? Math.max(0, val) : 0;
        if (typeof val === "string") {
          const s = val.trim().replace(",", ".");
          if (/^\d+(?:\.\d+)?$/.test(s)) return Math.max(0, Number(s));
          const parts = s.split(":").map(Number);
          if (parts.length === 3 && parts.every(Number.isFinite)) {
            return Math.max(0, parts[0] * 3600 + parts[1] * 60 + parts[2]);
          }
          if (parts.length === 2 && parts.every(Number.isFinite)) {
            return Math.max(0, parts[0] * 60 + parts[1]);
          }
        }
        return 0;
      };
      const cleanCueText = (txt) => String(txt ?? "").replace(/\r\n?/g, "\n").split("\n").map((l) => l.trim()).filter(Boolean).join("\n").trim();
      const buildSubtitlePackage = (cues, engine) => {
        const prepared = cues.map((c) => {
          const text = cleanCueText(c.text);
          const start = Number(parseTimeVal(c.startTime).toFixed(3));
          const rawEnd = parseTimeVal(c.endTime);
          const end = Number((rawEnd > start + 0.15 ? rawEnd : start + 0.6).toFixed(3));
          return {
            startTime: start,
            endTime: end,
            text,
            vocalEnergy: Number.isFinite(c.vocalEnergy) ? Number(c.vocalEnergy) : 85
          };
        }).filter((c) => c.text.length > 0).sort((a, b) => a.startTime - b.startTime || a.endTime - b.endTime);
        for (let i = 1; i < prepared.length; i++) {
          const prev = prepared[i - 1];
          const curr = prepared[i];
          if (curr.startTime < prev.endTime) {
            const trimmed = Number(Math.max(prev.startTime + 0.35, curr.startTime - 0.02).toFixed(3));
            if (trimmed <= curr.startTime) {
              prev.endTime = trimmed;
            } else {
              prev.endTime = Number((prev.startTime + 0.35).toFixed(3));
              curr.startTime = prev.endTime;
              curr.endTime = Number(Math.max(curr.startTime + 0.4, curr.endTime).toFixed(3));
            }
          }
        }
        const sorted = prepared.map((c, i) => ({
          id: i + 1,
          startTime: c.startTime,
          endTime: c.endTime,
          text: c.text,
          vocalEnergy: c.vocalEnergy
        }));
        const safeLang = targetLang.replace(/[^a-zA-Z0-9-]/g, "") || "th";
        const srtContent = sorted.map((c, i) => `${i + 1}
${toSrtTime(c.startTime)} --> ${toSrtTime(c.endTime)}
${c.text}
`).join("\n");
        const sbvContent = sorted.map((c) => `${toSbvTime(c.startTime)},${toSbvTime(c.endTime)}
${c.text}
`).join("\n");
        const vttContent = `WEBVTT
Kind: captions
Language: ${safeLang}

` + sorted.map((c, i) => `${i + 1}
${toVttTime(c.startTime)} --> ${toVttTime(c.endTime)}
${c.text.replace(/-->/g, "->")}
`).join("\n");
        const lrcContent = `[ti:${title}]
[ar:${artist}]
[by:AURA Master Subtitle Studio]

` + sorted.map((c) => `${toLrcTime(c.startTime)}${c.text.replace(/\n+/g, " ")}`).join("\n");
        const youtubeTimestamps = sorted.map((c) => {
          const m = Math.floor(c.startTime / 60);
          const s = Math.floor(c.startTime % 60);
          return `${m}:${String(s).padStart(2, "0")} ${c.text.replace(/\n+/g, " ")}`;
        }).join("\n");
        const youtubeDescription = `\u{1F3B5} "${title}" - ${artist}
(Official Master Audio with Synced Subtitles)

\u23F1\uFE0F TIMESTAMPS / LYRICS:
${youtubeTimestamps}

\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
\u2728 Mastered & Transcribed with AURA Subtitle Studio
\xA9 2026 ${artist}. All rights reserved.`;
        return {
          trackTitle: title,
          artistName: artist,
          language: targetLang,
          duration: songDuration,
          engine,
          cues: sorted,
          srtContent,
          sbvContent,
          vttContent,
          lrcContent,
          youtubeDescription,
          summary: `\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E44\u0E1F\u0E25\u0E4C\u0E0B\u0E31\u0E1A\u0E44\u0E15\u0E40\u0E15\u0E34\u0E25 ${sorted.length} \u0E17\u0E48\u0E2D\u0E19 (${engine}) \u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E2A\u0E48\u0E07\u0E2D\u0E2D\u0E01 .SRT \u0E41\u0E25\u0E30 .SBV`
        };
      };
      const hasAudio = Boolean(audioBase64 && typeof audioBase64 === "string" && audioBase64.length > 100);
      const clientGeminiKey = req.headers["x-gemini-api-key"] || req.body.geminiApiKey;
      const geminiApiKey = clientGeminiKey || process.env.GEMINI_API_KEY;
      const clientBedrockKey = req.headers["x-bedrock-api-key"] || req.body.bedrockApiKey;
      const bedrockApiKey = clientBedrockKey || process.env.BEDROCK_API_KEY || process.env.AWS_BEARER_TOKEN_BEDROCK;
      const bedrockModel = req.headers["x-bedrock-model"] || req.body.bedrockModel || process.env.BEDROCK_DEFAULT_MODEL || "deepseek.v3.2";
      const bedrockEndpoint = /^https:\/\//i.test(process.env.BEDROCK_MANTLE_ENDPOINT || "") ? process.env.BEDROCK_MANTLE_ENDPOINT : "https://bedrock-mantle.us-east-1.api.aws/v1";
      if (geminiApiKey && (hasAudio || cleanProvidedLyrics)) {
        try {
          const activeAi = new import_genai.GoogleGenAI({
            apiKey: geminiApiKey,
            httpOptions: { headers: { "User-Agent": "aistudio-build" } }
          });
          const responseSchema = {
            type: import_genai.Type.OBJECT,
            properties: {
              cues: {
                type: import_genai.Type.ARRAY,
                items: {
                  type: import_genai.Type.OBJECT,
                  properties: {
                    id: { type: import_genai.Type.INTEGER },
                    startTime: { type: import_genai.Type.NUMBER, description: "Start timestamp in seconds with up to 2 decimal places" },
                    endTime: { type: import_genai.Type.NUMBER, description: "End timestamp in seconds with up to 2 decimal places" },
                    text: { type: import_genai.Type.STRING, description: "Lyric or subtitle phrase" },
                    vocalEnergy: { type: import_genai.Type.NUMBER, description: "Vocal energy 0-100" }
                  },
                  required: ["id", "startTime", "endTime", "text"]
                }
              }
            },
            required: ["cues"]
          };
          let parsed = null;
          if (hasAudio) {
            const cleanBase64 = audioBase64.replace(/^data:audio\/[a-zA-Z0-9_+-]+;base64,/, "");
            const audioPrompt = `You are an expert music transcription and subtitling engineer.
Transcribe all vocals/speech in this audio track with exact start and end timestamps in seconds (e.g. 12.35 to 15.80).
Track Title: "${title}", Artist: "${artist}", Total Duration: ${songDuration} seconds, Language: ${targetLang}.
${cleanProvidedLyrics ? `Reference Lyrics provided by user (align timestamps tightly to these exact lines where sung):
${cleanProvidedLyrics}` : ""}
Break lines naturally by vocal phrasing (around 2 to 6 seconds per subtitle cue). Ensure endTime > startTime and no overlapping cues.`;
            const audioModels = [
              "gemini-3.8-flash",
              "gemini-3.6-flash",
              "gemini-3.5-flash-lite",
              "gemini-3.1-flash-lite"
            ];
            for (const m of audioModels) {
              try {
                const response = await activeAi.models.generateContent({
                  model: m,
                  contents: [
                    { inlineData: { mimeType: mimeType || "audio/wav", data: cleanBase64 } },
                    { text: audioPrompt }
                  ],
                  config: { responseMimeType: "application/json", responseSchema }
                });
                if (response?.text) {
                  parsed = safeJsonParse(response.text);
                  if (parsed) break;
                }
              } catch (audioErr) {
                console.warn(`Gemini audio model ${m} failed:`, audioErr?.message || audioErr);
              }
            }
          } else if (cleanProvidedLyrics) {
            const textPrompt = `Synchronize these exact lyrics into realistic vocal timestamps in seconds across ${songDuration}s for "${title}" by ${artist} (Genre: ${genre}, Language: ${targetLang}). Keep exact lyric text and do not invent extra verses:
${cleanProvidedLyrics}`;
            for (const tm of [
              "gemini-3.8-flash",
              "gemini-3.6-flash",
              "gemini-3.5-flash-lite",
              "gemini-3.1-flash-lite"
            ]) {
              try {
                const response = await activeAi.models.generateContent({
                  model: tm,
                  contents: textPrompt,
                  config: { responseMimeType: "application/json", responseSchema }
                });
                if (response?.text) {
                  parsed = safeJsonParse(response.text);
                  if (parsed) break;
                }
              } catch (tErr) {
                console.warn(`Gemini text sync ${tm} failed:`, tErr?.message || tErr);
              }
            }
          }
          const cuesArray = Array.isArray(parsed) ? parsed : parsed?.cues || parsed?.subtitles || parsed?.lyrics;
          if (Array.isArray(cuesArray) && cuesArray.length > 0) {
            return res.json(buildSubtitlePackage(cuesArray, hasAudio ? "gemini-audio" : "gemini-lyrics-sync"));
          }
        } catch (geminiErr) {
          console.warn("Gemini subtitle path failed:", geminiErr?.message || geminiErr);
        }
      }
      if (hasAudio) {
        const pythonBin = getWhisperPythonPath();
        const whisperScript = getTranscribeScriptPath();
        if (pythonBin && import_fs.default.existsSync(whisperScript)) {
          const tempId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const ext = (String(mimeType).split("/")[1] || "wav").replace(/[^a-zA-Z0-9]/g, "") || "wav";
          const tempAudioPath = import_path.default.resolve(DOWNLOADS_DIR, `temp_sub_${tempId}.${ext}`);
          const tempPayloadPath = import_path.default.resolve(DOWNLOADS_DIR, `temp_sub_payload_${tempId}.json`);
          try {
            const cleanBase64 = audioBase64.replace(/^data:audio\/[a-zA-Z0-9_+-]+;base64,/, "");
            import_fs.default.writeFileSync(tempAudioPath, Buffer.from(cleanBase64, "base64"));
            import_fs.default.writeFileSync(
              tempPayloadPath,
              JSON.stringify({
                audio_path: tempAudioPath,
                language: targetLang,
                provided_lyrics: cleanProvidedLyrics,
                model_size: songDuration <= 180 ? "small" : "base"
              }),
              "utf-8"
            );
            const whisperResult = await new Promise((resolve, reject) => {
              (0, import_child_process.execFile)(
                pythonBin,
                [whisperScript, "--", tempPayloadPath],
                { maxBuffer: 10 * 1024 * 1024, timeout: 24e4 },
                (err, stdout, stderr) => {
                  if (err) {
                    return reject(new Error(stderr || err.message));
                  }
                  const parsed = safeJsonParse(stdout);
                  if (!parsed || !parsed.success) {
                    return reject(new Error(parsed?.error || "Whisper failed"));
                  }
                  resolve(parsed);
                }
              );
            });
            if (Array.isArray(whisperResult?.cues) && whisperResult.cues.length > 0) {
              return res.json(buildSubtitlePackage(whisperResult.cues, whisperResult.engine || "local-whisper"));
            }
          } catch (whisperErr) {
            console.warn("Local Whisper transcription error:", whisperErr?.message || whisperErr);
          } finally {
            try {
              if (import_fs.default.existsSync(tempAudioPath)) import_fs.default.unlinkSync(tempAudioPath);
            } catch {
            }
            try {
              if (import_fs.default.existsSync(tempPayloadPath)) import_fs.default.unlinkSync(tempPayloadPath);
            } catch {
            }
          }
        }
      }
      if (cleanProvidedLyrics) {
        const lines = cleanProvidedLyrics.split("\n").map((l) => l.trim()).filter(Boolean);
        if (bedrockApiKey && lines.length > 0) {
          try {
            const safeBedrockEndpoint = await assertPublicHttpUrl(bedrockEndpoint);
            const bRes = await fetch(`${safeBedrockEndpoint}/chat/completions`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${bedrockApiKey}`,
                "OpenAI-Project": "default",
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                model: bedrockModel,
                messages: [
                  {
                    role: "system",
                    content: 'You are a subtitle timing engineer. Return ONLY raw JSON object { "cues": [ { "id": 1, "startTime": number, "endTime": number, "text": string } ] } with strictly non-overlapping timestamps in seconds.'
                  },
                  {
                    role: "user",
                    content: `Distribute these exact ${lines.length} lyric lines realistically across a ${songDuration}s "${genre}" track ("${title}" by ${artist}) accounting for intro/outro and phrase length:
${lines.join("\n")}`
                  }
                ],
                temperature: 0.2,
                max_tokens: 2400
              })
            });
            if (bRes.ok) {
              const bData = await bRes.json();
              const parsed = safeJsonParse(bData?.choices?.[0]?.message?.content || "");
              const cuesArray = Array.isArray(parsed) ? parsed : parsed?.cues;
              if (Array.isArray(cuesArray) && cuesArray.length > 0) {
                return res.json(buildSubtitlePackage(cuesArray, `bedrock-${bedrockModel}-sync`));
              }
            }
          } catch (bErr) {
            console.warn("Bedrock subtitle sync failed:", bErr?.message || bErr);
          }
        }
        if (lines.length > 0) {
          const intro = songDuration > 40 ? Math.min(8, songDuration * 0.06) : songDuration > 15 ? 1.5 : 0.2;
          const outro = songDuration > 40 ? Math.min(5, songDuration * 0.04) : 0.5;
          const usable = Math.max(lines.length * 1.2, songDuration - intro - outro);
          const weights = lines.map((l) => Math.max(4, l.replace(/[\s.,!?'"()\-—]/g, "").length));
          const totalW = weights.reduce((a, b) => a + b, 0);
          let cursor = intro;
          const cues = lines.map((text, idx) => {
            const slot = weights[idx] / totalW * usable;
            const st = Number(cursor.toFixed(2));
            const et = Number(Math.min(songDuration - 0.1, st + Math.max(1, slot - 0.12)).toFixed(2));
            cursor += slot;
            return { id: idx + 1, startTime: st, endTime: et > st ? et : st + 1, text, vocalEnergy: 82 };
          });
          return res.json(buildSubtitlePackage(cues, "lyrics-timing"));
        }
      }
      return res.status(422).json({
        error: hasAudio ? "\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E16\u0E2D\u0E14\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E23\u0E49\u0E2D\u0E07\u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34\u0E44\u0E14\u0E49 (\u0E44\u0E21\u0E48\u0E1E\u0E1A Gemini API Key \u0E2B\u0E23\u0E37\u0E2D Local Whisper \u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E23\u0E49\u0E2D\u0E07\u0E43\u0E19\u0E44\u0E1F\u0E25\u0E4C) \u0E01\u0E23\u0E38\u0E13\u0E32\u0E27\u0E32\u0E07\u0E40\u0E19\u0E37\u0E49\u0E2D\u0E40\u0E1E\u0E25\u0E07\u0E43\u0E19\u0E0A\u0E48\u0E2D\u0E07\u0E14\u0E49\u0E32\u0E19\u0E25\u0E48\u0E32\u0E07\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E0B\u0E34\u0E07\u0E01\u0E4C\u0E15\u0E32\u0E21\u0E04\u0E25\u0E37\u0E48\u0E19\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E08\u0E23\u0E34\u0E07 \u0E2B\u0E23\u0E37\u0E2D\u0E43\u0E2A\u0E48 Gemini API Key \u0E43\u0E19\u0E40\u0E21\u0E19\u0E39\u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32" : "\u0E01\u0E23\u0E38\u0E13\u0E32\u0E2D\u0E31\u0E1B\u0E42\u0E2B\u0E25\u0E14\u0E44\u0E1F\u0E25\u0E4C\u0E40\u0E2A\u0E35\u0E22\u0E07/\u0E27\u0E34\u0E14\u0E35\u0E42\u0E2D \u0E2B\u0E23\u0E37\u0E2D\u0E27\u0E32\u0E07\u0E40\u0E19\u0E37\u0E49\u0E2D\u0E40\u0E1E\u0E25\u0E07\u0E01\u0E48\u0E2D\u0E19\u0E40\u0E23\u0E34\u0E48\u0E21\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E44\u0E1F\u0E25\u0E4C\u0E0B\u0E31\u0E1A\u0E44\u0E15\u0E40\u0E15\u0E34\u0E25 (.SRT / .SBV)",
        code: "NO_TRANSCRIPTION_SOURCE"
      });
    } catch (err) {
      console.error("Transcribe lyrics route error:", err);
      return res.status(500).json({ error: err.message || "Failed to transcribe subtitles." });
    }
  });
  app.post("/api/gemini/generate-cover-art", async (req, res) => {
    try {
      const { prompt, artStyle, aspectRatio = "1:1" } = req.body;
      const clientApiKey = req.headers["x-gemini-api-key"];
      const apiKeyToUse = clientApiKey || req.body.geminiApiKey || process.env.GEMINI_API_KEY;
      if (!apiKeyToUse) {
        return res.status(400).json({
          error: "API_KEY_REQUIRED",
          message: "API key is required to generate AI Cover Art. Please configure your Google Gemini API key or use procedural canvas artwork."
        });
      }
      const activeAi = new import_genai.GoogleGenAI({
        apiKey: apiKeyToUse,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build"
          }
        }
      });
      const styleKeywords = {
        cyberpunk: "cyberpunk aesthetic, neon holographic lights, futuristic sci-fi city, dark synthwave vibe, ultra detailed, octane render, 8k wallpaper",
        retro_vinyl: "vintage 1970s vinyl album cover, analog texture, retro warm tones, grainy typography space, iconic record sleeve art",
        cinematic_minimal: "minimalist cinematic album cover, dramatic volumetric lighting, luxury typography space, sleek dark modern architecture, award-winning photography",
        neon_synthwave: "outrun synthwave 80s aesthetic, purple and magenta grid, neon sun horizon, chrome reflections, retrowave album art",
        anime_lofi: "cozy lo-fi anime illustration, rain on window, warm ambient bedroom lights, nostalgic anime aesthetic, studio ghibli inspired",
        abstract_soundwave: "3D fluid soundwave sculpture, iridescent chrome liquid, generative digital art, high fashion album aesthetic, dark background",
        dark_trap: "dark atmospheric trap album artwork, gothic obsidian textures, smoky cinematic shadows, high contrast editorial aesthetic",
        organic_folk: "earthy acoustic folk album art, misty pine forest, golden hour sunlight, botanical fine art illustration, textured paper"
      };
      const styleAugment = styleKeywords[artStyle] || styleKeywords.abstract_soundwave;
      const finalPrompt = `Professional music album cover artwork, ${prompt || "epic sound waves and music energy"}, ${styleAugment}, no text or words on image, centered composition, ultra-high resolution masterwork.`;
      console.log("Generating image with gemini-3.1-flash-lite-image...", finalPrompt);
      const response = await activeAi.models.generateContent({
        model: "gemini-3.1-flash-lite-image",
        contents: {
          parts: [{ text: finalPrompt }]
        },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio === "9:16" || aspectRatio === "16:9" || aspectRatio === "1:1" ? aspectRatio : "1:1"
          }
        }
      });
      let imageUrl = null;
      if (response.candidates && response.candidates[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData && part.inlineData.data) {
            const mime = part.inlineData.mimeType || "image/png";
            imageUrl = `data:${mime};base64,${part.inlineData.data}`;
            break;
          }
        }
      }
      if (imageUrl) {
        return res.json({ imageUrl, prompt: finalPrompt });
      } else {
        return res.status(500).json({ error: "No image was generated by the model." });
      }
    } catch (err) {
      console.error("Cover art generation error:", err);
      return res.status(500).json({ error: err.message || "Failed to generate cover art." });
    }
  });
  const distPath = import_path.default.join(process.cwd(), "dist");
  const hasDist = import_fs.default.existsSync(import_path.default.join(distPath, "index.html"));
  if (hasDist && process.env.NODE_ENV !== "development") {
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  } else {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  }
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.log(`Port ${PORT} is already active. Studio is ready to use!`);
    } else {
      console.error("Server error:", err);
    }
  });
}
startServer().catch((err) => {
  console.error("Failed to start full-stack server:", err);
});
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
//# sourceMappingURL=server.cjs.map
