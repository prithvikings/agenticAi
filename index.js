import dotenv from "dotenv";
dotenv.config();

import { ChatMistralAI } from "@langchain/mistralai";
import { tool } from "@langchain/core/tools";
import { createAgent } from "langchain";
import { MemorySaver } from "@langchain/langgraph";
import { createInterface } from "readline/promises";
import * as z from "zod";
import { tavily } from "@tavily/core";

/**
 * =========================================================
 * CONFIGURATION
 * =========================================================
 */

const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
});

const tvly = tavily({
    apiKey: process.env.TAVILY_API_KEY,
});

const model = new ChatMistralAI({
    model: "mistral-small-latest",
    apiKey: process.env.MISTRALAI_API_KEY,
});

/**
 * =========================================================
 * WEB SEARCH TOOL
 * =========================================================
 *
 * This tool is used internally by the agent.
 *
 * IMPORTANT:
 * We never print the tool result directly to the CLI.
 *
 * Tavily results → Agent → Final AI answer
 */

const getLatestInformation = tool(
    async ({ query }) => {
        const response = await tvly.search(query);

        /**
         * We only give the model the first 5 results.
         * This keeps the context smaller.
         */
        return response.results
            .slice(0, 5)
            .map((result, index) => {
                return `
Source ${index + 1}
Title: ${result.title}
URL: ${result.url}
Content: ${result.content}
`;
            })
            .join("\n-------------------------\n");
    },
    {
        name: "get_latest_information",

        description:
            "Search the web for current and recent information, " +
            "news, speeches, statements, events, weather, " +
            "or anything that may have changed recently. " +
            "Use this tool whenever the user asks about current information.",

        schema: z.object({
            query: z
                .string()
                .describe(
                    "The search query to find current information"
                ),
        }),
    }
);

/**
 * =========================================================
 * MEMORY
 * =========================================================
 *
 * MemorySaver stores the conversation in memory.
 *
 * This means we don't manually maintain:
 *
 *   messages.push(new HumanMessage(...))
 *   messages.push(new AIMessage(...))
 *
 * The agent manages the conversation state.
 *
 * For a production application, use a persistent
 * checkpointer/database instead.
 */

const checkpointer = new MemorySaver();

/**
 * =========================================================
 * AGENT
 * =========================================================
 */

const agent = createAgent({
    model,

    tools: [getLatestInformation],

    checkpointer,

    systemPrompt: `
You are Prithvi.

You are a joyful, knowledgeable instructor and helpful assistant.

Your main job is to help users learn programming and coding.

Explain concepts clearly and teach rather than simply giving
short answers.

You can also answer general questions.

IMPORTANT:
Whenever the user asks about current or recent information,
news, speeches, statements, events, weather, people, or
anything that may have changed recently, use the
get_latest_information tool.

Do not rely on your own knowledge for current events.

When using search results:

- Do not dump raw search results to the user.
- Summarize the relevant information.
- Answer the user's actual question directly.
- Follow the requested word count when provided.
- Do not mention internal tools unless necessary.

The current date is ${new Date().toLocaleDateString()}.
`,
});

/**
 * =========================================================
 * CLI COMMANDS
 * =========================================================
 */

const EXIT_COMMANDS = new Set([
    "exit",
    "quit",
    "/exit",
    "/quit",
]);

const HELP_COMMANDS = new Set([
    "help",
    "/help",
]);

function printHelp() {
    console.log(`
Available commands:

  /help       Show this help message
  /exit       Exit the application
  /quit       Exit the application

You can also use:

  exit
  quit

Keyboard:

  Ctrl+C      Exit the application
`);
}

/**
 * =========================================================
 * SPINNER
 * =========================================================
 *
 * Shows a small animated spinner while the agent works.
 *
 * Example:
 *
 *   ⠋ Thinking...
 *   ⠙ Thinking...
 *   ⠹ Thinking...
 */

const spinnerFrames = [
    "⠋",
    "⠙",
    "⠹",
    "⠸",
    "⠼",
    "⠴",
    "⠦",
    "⠧",
    "⠇",
    "⠏",
];

let spinnerTimer = null;
let spinnerIndex = 0;
let spinnerMessage = "";

function startSpinner(message = "Thinking") {
    spinnerMessage = message;
    spinnerIndex = 0;

    process.stdout.write(
        `\r${spinnerFrames[spinnerIndex]} ${spinnerMessage}...`
    );

    spinnerTimer = setInterval(() => {
        spinnerIndex =
            (spinnerIndex + 1) % spinnerFrames.length;

        process.stdout.write(
            `\r${spinnerFrames[spinnerIndex]} ${spinnerMessage}...`
        );
    }, 80);
}

function stopSpinner() {
    if (spinnerTimer) {
        clearInterval(spinnerTimer);
        spinnerTimer = null;
    }

    // Clear the current spinner line.
    process.stdout.write("\r\x1b[K");
}

/**
 * =========================================================
 * EXTRACT AI TEXT
 * =========================================================
 *
 * Different LangChain/model versions can represent
 * message content differently.
 *
 * This helper handles both:
 *
 *   "Hello"
 *
 * and:
 *
 *   [{ type: "text", text: "Hello" }]
 */

function extractText(content) {
    if (typeof content === "string") {
        return content;
    }

    if (Array.isArray(content)) {
        return content
            .filter(
                (block) =>
                    block &&
                    typeof block.text === "string"
            )
            .map((block) => block.text)
            .join("");
    }

    return "";
}

/**
 * =========================================================
 * MAIN CHAT
 * =========================================================
 */

async function chat() {
    console.log("🤖 Prithvi AI");
    console.log("Type /help for commands.");
    console.log("Type /exit to quit.\n");

    /**
     * Every CLI session gets its own conversation thread.
     */
    const threadId = `cli-${Date.now()}`;

    const config = {
        configurable: {
            thread_id: threadId,
        },
    };

    while (true) {
        let userPrompt;

        /**
         * -------------------------------------------------
         * Read user input
         * -------------------------------------------------
         */

        try {
            userPrompt = await readline.question("You: ");
        } catch (error) {
            /**
             * Ctrl+C causes readline.question() to reject
             * with an AbortError.
             */
            if (error?.code === "ABORT_ERR") {
                console.log("\nGoodbye! 👋");
                return;
            }

            throw error;
        }

        const input = userPrompt.trim();

        // Ignore empty messages.
        if (!input) {
            continue;
        }

        const command = input.toLowerCase();

        /**
         * -------------------------------------------------
         * Commands
         * -------------------------------------------------
         */

        if (EXIT_COMMANDS.has(command)) {
            console.log("Goodbye! 👋");
            return;
        }

        if (HELP_COMMANDS.has(command)) {
            printHelp();
            continue;
        }

        /**
         * -------------------------------------------------
         * Run agent
         * -------------------------------------------------
         *
         * We intentionally use "updates" only.
         *
         * Why?
         *
         * Because we don't want to print ToolMessage
         * content to the user.
         *
         * The agent's updates contain enough information
         * for us to:
         *
         * 1. Detect tool calls
         * 2. Show progress
         * 3. Get the final AI response
         */

        let finalAnswer = "";
        let searchShown = false;

        try {
            startSpinner("Thinking");

            const stream = await agent.stream(
                {
                    messages: [
                        {
                            role: "user",
                            content: input,
                        },
                    ],
                },
                {
                    ...config,

                    /**
                     * We only need agent state updates.
                     */
                    streamMode: "updates",
                }
            );

            /**
             * -------------------------------------------------
             * Consume the stream ONCE
             * -------------------------------------------------
             */

            for await (const update of stream) {

                /**
                 * Each update contains one or more agent
                 * state changes.
                 *
                 * We inspect all of them instead of assuming
                 * a particular node name.
                 */
                for (const [nodeName, nodeUpdate] of Object.entries(
                    update
                )) {

                    /**
                     * -----------------------------------------
                     * Inspect messages
                     * -----------------------------------------
                     */

                    const updateMessages =
                        nodeUpdate?.messages ?? [];

                    for (const message of updateMessages) {

                        /**
                         * -------------------------------------
                         * Tool call detected
                         * -------------------------------------
                         */

                        if (
                            message?.tool_calls &&
                            message.tool_calls.length > 0
                        ) {

                            for (const call of message.tool_calls) {

                                if (
                                    call.name ===
                                    "get_latest_information"
                                ) {

                                    stopSpinner();

                                    console.log(
                                        `🔎 Searching the web for: ${
                                            call.args?.query ??
                                            "current information"
                                        }`
                                    );

                                    startSpinner(
                                        "Reading search results"
                                    );

                                    searchShown = true;
                                }
                            }
                        }

                        /**
                         * -------------------------------------
                         * Tool result
                         * -------------------------------------
                         *
                         * We deliberately DO NOT print
                         * ToolMessage.content.
                         *
                         * That's the raw Tavily data.
                         */

                        if (
                            message?.type === "tool" ||
                            message?.role === "tool"
                        ) {

                            if (searchShown) {
                                stopSpinner();

                                console.log(
                                    "✓ Search complete"
                                );

                                console.log();

                                startSpinner(
                                    "Preparing answer"
                                );
                            }

                            continue;
                        }

                        /**
                         * -------------------------------------
                         * AI response
                         * -------------------------------------
                         */

                        const messageType =
                            message?.type ??
                            message?.role ??
                            "";

                        if (
                            messageType === "ai" ||
                            messageType === "AIMessage"
                        ) {

                            /**
                             * Ignore AI messages that are
                             * only making a tool call.
                             */
                            if (
                                message?.tool_calls &&
                                message.tool_calls.length > 0
                            ) {
                                continue;
                            }

                            const text = extractText(
                                message.content
                            );

                            if (text) {
                                finalAnswer = text;
                            }
                        }
                    }
                }
            }

            /**
             * -------------------------------------------------
             * Display final answer
             * -------------------------------------------------
             */

            stopSpinner();

            if (finalAnswer) {
                console.log(`AI: ${finalAnswer}\n`);
            } else {
                console.log(
                    "AI: I wasn't able to generate a response.\n"
                );
            }

        } catch (error) {

            stopSpinner();

            console.error("\n❌ Request failed:");

            if (error instanceof Error) {
                console.error(error.message);
            } else {
                console.error(error);
            }

            console.log();
        }
    }
}

/**
 * =========================================================
 * START APPLICATION
 * =========================================================
 */

try {
    await chat();
} catch (error) {
    console.error("\nFatal error:", error);
} finally {
    /**
     * Always close readline when the application exits.
     */
    readline.close();

    /**
     * Make sure the spinner cannot keep Node alive.
     */
    if (spinnerTimer) {
        clearInterval(spinnerTimer);
    }
}
