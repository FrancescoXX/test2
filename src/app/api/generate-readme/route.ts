// src/app/api/generate-readme/route.ts
import { NextResponse } from 'next/server';
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  GenerateContentResult // Import necessary types if needed elsewhere, though often inferred
} from '@google/generative-ai';

// --- Configuration ---
const MODEL_NAME = "gemini-1.5-flash-latest"; // Or use "gemini-pro", "gemini-1.0-pro", etc.

export async function POST(request: Request) {
  console.log("Received request for /api/generate-readme");

  // --- Get API Key ---
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error("GOOGLE_API_KEY is not defined in environment variables.");
    // Avoid exposing exact internal errors to the client
    return NextResponse.json({ error: 'Server configuration error. Please contact support if this persists.' }, { status: 500 });
  }

  // --- Get repoUrl from request body ---
  let repoUrl: string;
  try {
    const body = await request.json();
    repoUrl = body.repoUrl;
    if (!repoUrl || typeof repoUrl !== 'string' || !repoUrl.startsWith('http')) {
      console.warn(`Invalid repoUrl received: ${repoUrl}`);
      return NextResponse.json({ error: 'Invalid or missing repository URL provided. Must start with http/https.' }, { status: 400 });
    }
    console.log(`Processing URL: ${repoUrl}`);
  } catch (error) {
    console.error("Failed to parse request body:", error);
    return NextResponse.json({ error: 'Invalid request format.' }, { status: 400 });
  }

  // --- Initialize Google AI & Generate Content ---
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    // --- Define Generation Config (Optional but Recommended) ---
    const generationConfig = {
      temperature: 0.8, // Controls randomness (0=deterministic, 1=max random)
      topK: 1,          // Considers the top K most likely tokens
      topP: 1,          // Considers tokens based on cumulative probability
      maxOutputTokens: 8192, // Max length of the generated response
    };

    // --- Define Safety Settings (Optional but Recommended) ---
    // Adjust thresholds based on your application's tolerance
    const safetySettings = [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    ];

    // --- Construct the Prompt ---
    // TODO: Enhance this prompt. Consider fetching repo details (languages, file structure)
    // using GitHub API (if applicable) or a general web scraping method (use cautiously)
    // to provide more context to the AI for a significantly better README.
    const prompt = `
      Generate a comprehensive and well-structured README.md file in Markdown format for a project located at the following repository URL: ${repoUrl}

      Please include the following sections (if applicable, otherwise omit or provide sensible placeholders):
      - Project Title (Infer from URL or create a suitable one)
      - Badges (Suggest common badges like build status, license, version - e.g., using shields.io placeholders)
      - Brief Description/Introduction (Summarize the project's purpose)
      - Key Features (List main capabilities)
      - Technologies Used (Attempt to infer or list common technologies based on the URL/domain)
      - Demo/Screenshots (Suggest adding these if applicable)
      - Getting Started (Include Prerequisites and clear Installation steps - provide generic examples if specific details aren't inferable)
      - Usage (Explain how to run or use the project - provide generic examples if needed)
      - Configuration (Mention if configuration is likely needed, e.g., environment variables)
      - Contributing (Include standard placeholder contribution guidelines)
      - License (State that a license should be chosen, e.g., suggest MIT License text or placeholder)
      - Contact/Support (Optional placeholder)

      Format the output strictly as Markdown content suitable for a README.md file.
      Do not include any conversational text, preamble, or explanation before or after the Markdown content itself.
      Start directly with the Markdown (e.g., starting with the '# Project Title').
      Use standard Markdown syntax, including headings, lists, code blocks etc.
    `;

    console.log(`Sending prompt for ${repoUrl} to Google AI model ${MODEL_NAME}...`);

    // --- Generate Content ---
    const result: GenerateContentResult = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig,
        safetySettings,
      });

    // --- Handle Response ---

    // 1. Check if the main response object exists at all
    if (!result.response) {
      console.error("AI generation failed: No response object received from the model.");
      return NextResponse.json({ error: 'AI generation failed: No response received. Check API key, model name, or network status.' }, { status: 500 });
    }

    // 2. Try to get the text content. This might fail if blocked.
    try {
      const generatedText = result.response.text();
      console.log(`Successfully generated README content for ${repoUrl}.`);
      return NextResponse.json({ readme: generatedText });

    } catch (error: any) {
      // 3. If getting text fails, it might be due to blocking or other response issues.
      console.error(`Failed to extract text from AI response for ${repoUrl}, potentially blocked:`, error);

      // Attempt to get detailed feedback from the response
      const promptFeedback = result.response?.promptFeedback;
      const blockReason = promptFeedback?.blockReason;
      const safetyRatings = promptFeedback?.safetyRatings;
      const finishReason = result.response?.candidates?.[0]?.finishReason;

      // Log details for server-side debugging
      console.error("Block Reason:", blockReason);
      console.error("Finish Reason:", finishReason);
      console.error("Safety Ratings:", JSON.stringify(safetyRatings, null, 2)); // Log full ratings

      // Construct a more informative error message for the client
      let clientErrorMessage = `AI response error: Failed to generate content. Reason: ${error.message || 'Extraction error'}.`;
      if (blockReason) {
        clientErrorMessage += ` Blocking Reason: ${blockReason}.`;
      }
      if (finishReason && finishReason !== "STOP") { // Only show if not a normal stop
          clientErrorMessage += ` Finish Reason: ${finishReason}.`;
      }
      // Consider if you want to expose safety rating details to the client
      // For security/simplicity, often just the block/finish reason is enough

      return NextResponse.json({ error: clientErrorMessage }, { status: 500 });
    }

  } catch (error: any) {
    // Catch errors during AI initialization or the request itself
    console.error(`Error during AI processing for ${repoUrl || 'unknown URL'}:`, error);
    const errorMessage = error.message || 'An unknown error occurred during README generation.';
    return NextResponse.json({ error: `Failed to process request: ${errorMessage}` }, { status: 500 });
  }
}