const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse");
const Material = require("../models/Material");
const { askGemini } = require("../utils/gemini");

// Helper: read uploaded file text (.txt, .md, or .pdf)
const readFileText = async (filePath, originalName = "") => {
  const ext = path.extname(originalName || filePath).toLowerCase();
  if (ext === ".pdf") {
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(dataBuffer);
    return pdfData.text || "";
  }
  return fs.readFileSync(filePath, "utf-8");
};

// Helper: safe JSON parsing from Gemini output
const extractJSON = (text) => {
  if (!text) throw new Error("Empty AI response");
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const startBracket = cleaned.indexOf("[");
    const endBracket = cleaned.lastIndexOf("]");
    if (startBracket !== -1 && endBracket !== -1 && endBracket > startBracket) {
      const candidate = cleaned.slice(startBracket, endBracket + 1);
      return JSON.parse(candidate);
    }
    const startBrace = cleaned.indexOf("{");
    const endBrace = cleaned.lastIndexOf("}");
    if (startBrace !== -1 && endBrace !== -1 && endBrace > startBrace) {
      const candidate = cleaned.slice(startBrace, endBrace + 1);
      return JSON.parse(candidate);
    }
    throw new Error("Could not parse AI response as JSON: " + text);
  }
};

// POST /api/materials/upload
const uploadMaterial = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });

  let content = "";
  try {
    content = await readFileText(req.file.path, req.file.originalname);
  } finally {
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
  }

  if (!content || !content.trim()) {
    return res.status(400).json({ message: "Uploaded file is empty or unreadable" });
  }

  const { title } = req.body;

  const material = await Material.create({
    user: req.user.userId,
    title: title || req.file.originalname,
    content: content.trim(),
    filename: req.file.originalname,
  });

  res.status(201).json({ message: "Material uploaded", material });
};

// GET /api/materials
const getMaterials = async (req, res) => {
  const filter = req.user.role === "admin" ? {} : { user: req.user.userId };
  const materials = await Material.find(filter)
    .select("-content -flashcards -quiz -studyPlan")
    .sort("-createdAt");
  res.json(materials);
};

// GET /api/materials/:id
const getMaterial = async (req, res) => {
  const material = await Material.findById(req.params.id);
  if (!material) return res.status(404).json({ message: "Not found" });

  // Students can only access their own
  if (req.user.role !== "admin" && material.user.toString() !== req.user.userId) {
    return res.status(403).json({ message: "Access denied" });
  }

  res.json(material);
};

// DELETE /api/materials/:id
const deleteMaterial = async (req, res) => {
  const material = await Material.findById(req.params.id);
  if (!material) return res.status(404).json({ message: "Not found" });

  if (req.user.role !== "admin" && material.user.toString() !== req.user.userId) {
    return res.status(403).json({ message: "Access denied" });
  }

  await material.deleteOne();
  res.json({ message: "Deleted" });
};

// POST /api/materials/:id/summarize
const summarize = async (req, res) => {
  const material = await Material.findById(req.params.id);
  if (!material) return res.status(404).json({ message: "Not found" });

  if (req.user.role !== "admin" && material.user.toString() !== req.user.userId) {
    return res.status(403).json({ message: "Access denied" });
  }

  const prompt = `Summarize the following study material clearly and concisely in bullet points:\n\n${material.content}`;
  const summary = await askGemini(prompt);

  material.summary = summary;
  await material.save();

  res.json({ summary });
};

// POST /api/materials/:id/flashcards
const generateFlashcards = async (req, res) => {
  const material = await Material.findById(req.params.id);
  if (!material) return res.status(404).json({ message: "Not found" });

  if (req.user.role !== "admin" && material.user.toString() !== req.user.userId) {
    return res.status(403).json({ message: "Access denied" });
  }

  const count = req.body.count || 5;

  const prompt = `
Create ${count} flashcards from the study material below.
Return ONLY valid JSON in this format, no extra text:
[{"question": "...", "answer": "..."}]

Study material:
${material.content}
`;

  const raw = await askGemini(prompt);
  const flashcards = extractJSON(raw);

  material.flashcards = flashcards;
  await material.save();

  res.json({ flashcards });
};

// POST /api/materials/:id/quiz
const generateQuiz = async (req, res) => {
  const material = await Material.findById(req.params.id);
  if (!material) return res.status(404).json({ message: "Not found" });

  if (req.user.role !== "admin" && material.user.toString() !== req.user.userId) {
    return res.status(403).json({ message: "Access denied" });
  }

  const count = req.body.count || 5;

  const prompt = `
Create ${count} multiple choice quiz questions from the study material below.
Return ONLY valid JSON in this format, no extra text:
[{"question": "...", "options": ["A", "B", "C", "D"], "answer": "A"}]

Study material:
${material.content}
`;

  const raw = await askGemini(prompt);
  const quiz = extractJSON(raw);

  material.quiz = quiz;
  await material.save();

  res.json({ quiz });
};

// POST /api/materials/:id/study-plan
const generateStudyPlan = async (req, res) => {
  const material = await Material.findById(req.params.id);
  if (!material) return res.status(404).json({ message: "Not found" });

  if (req.user.role !== "admin" && material.user.toString() !== req.user.userId) {
    return res.status(403).json({ message: "Access denied" });
  }

  const { goal, hoursPerDay, days } = req.body;

  const prompt = `
You are a study planner. Based on the study material below, create a personalized ${days || 7}-day study plan.
Student's goal: ${goal || "Understand and retain the material"}
Available study time: ${hoursPerDay || 2} hours per day.

Return a clear day-by-day schedule with topics and activities.

Study material:
${material.content}
`;

  const studyPlan = await askGemini(prompt);

  material.studyPlan = studyPlan;
  await material.save();

  res.json({ studyPlan });
};

module.exports = {
  uploadMaterial,
  getMaterials,
  getMaterial,
  deleteMaterial,
  summarize,
  generateFlashcards,
  generateQuiz,
  generateStudyPlan,
};
