const express = require('express');
const bodyParser = require('body-parser');
const { ChatOpenAI } = require('@langchain/openai');
const { PromptTemplate } = require('@langchain/core/prompts');
const { StructuredOutputParser } = require('langchain/output_parsers');
require('dotenv').config();

const app = express();
const port = 3000;

app.use(bodyParser.json());

// Define parser schema that includes success or error
const parser = StructuredOutputParser.fromNamesAndDescriptions({
  translatedText: "The translated version of the input text",
  language: "The language of the translated text"
});

const formatInstructions = parser.getFormatInstructions();

// Updated prompt with translation-only rule
const prompt = new PromptTemplate({
  template: `
You are an expert translator. Translate the following text into {targetLanguage}. Respond only with a JSON object in this format:

{format_instructions}

Text: {text}
`,
  inputVariables: ["text", "targetLanguage"],
  partialVariables: { format_instructions: formatInstructions }
});


// Setup OpenAI Chat model
const model = new ChatOpenAI({
  openAIApiKey: process.env.OPEN_API_KEY,
  temperature: 0,
  model: "gpt-3.5-turbo"
});

// Translation function
async function translate(text, targetLanguage) {
  const promptInput = await prompt.format({ text, targetLanguage });

  const res = await model.invoke(promptInput);

  const rawContent = res.content || res.text || res;

  const jsonString = rawContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');

  return JSON.parse(jsonString);
}

// POST route for /translate
app.post('/translate', async (req, res) => {
  try {
    const { text, targetLanguage } = req.body;

    if (!text || !targetLanguage) {
      return res.status(400).json({ error: "Please provide both 'text' and 'targetLanguage' in the request body" });
    }

    const response = await translate(text, targetLanguage);

    // If error field exists in AI response, send it with 400 status
    if (response.error) {
      return res.status(400).json({ error: response.error });
    }

    res.json({ result: response });
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


app.listen(port, ()=>{
    console.log(`Server is running 0n http://localhost:${port}`);
});