import dotenv from "dotenv";
dotenv.config();

import { ChatMistralAI } from "@langchain/mistralai";
import { createInterface } from "readline/promises";
import rl from "readline/promises";

const readline = rl.createInterface({
    input:process.stdin,    
    output:process.stdout
});

const model = new chatMistralAI({
    model: "mistral-small-latest",
    apiKey: process.env.MISTRALAI_API_KEY 
})

while(true){
    const userPrompt = await readline.question("User: ");
    const stream = await model.stream(userPrompt);
    for await (const token of stream){
        process.stdout.write(token);
    }
    process.stdout.write("\n");
}