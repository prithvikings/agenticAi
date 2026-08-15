# AgenticAI

A JavaScript/Node.js learning project for building a tool-using conversational AI agent with **Mistral AI**, **LangChain**, **LangGraph**, and **Tavily**.

## What it does

- Uses Mistral AI for conversational responses
- Uses Tavily for current web information and recent events
- Lets the agent decide when a web search is needed
- Maintains conversation state with LangGraph memory
- Provides a simple interactive CLI
- Supports `/help`, `/exit`, `/quit`, `exit`, and `quit`
- Handles `Ctrl+C` gracefully
- Keeps raw tool/search results internal and presents a cleaner user-facing response

## Architecture

```text
User
  ↓
CLI
  ↓
LangChain Agent
  ├── Mistral AI
  └── Tavily Web Search
          ↓
      Search Results
          ↓
       Agent
          ↓
     Final Answer
          ↓
      CLI Output

LangGraph Checkpointer
        ↓
 Conversation Memory
```

## Tech Stack

- JavaScript (ES Modules)
- Node.js
- Mistral AI
- LangChain
- LangGraph
- Tavily
- Zod
- dotenv

## Setup

Clone the repository and install dependencies:

```bash
git clone https://github.com/prithvikings/agenticAi.git
cd agenticAi
npm install
```

Create a `.env` file:

```env
MISTRALAI_API_KEY=your_mistral_api_key
TAVILY_API_KEY=your_tavily_api_key
```

Start the agent:

```bash
node index.js
```

Or:

```bash
npm start
```

## CLI Commands

```text
/help    Show available commands
/exit    Exit the application
/quit    Exit the application
exit     Exit the application
quit     Exit the application
Ctrl+C   Exit the application
```

## Example

```text
🤖 Prithvi AI
Type /help for commands.
Type /exit to quit.

You: What is recursion?

AI: Recursion is a technique where a function calls itself...

You: What happened in today's news?

🔎 Searching the web for: today's latest news
✓ Search complete

AI: Here are the most relevant recent developments...
```

## Project Goal

This repository is primarily a hands-on learning project for understanding how modern AI agents work: model calls, tools, web search, agent state, memory, streaming, and CLI interaction.

## Future Improvements

- Persistent production-grade checkpointer/database
- More tools such as weather, calculator, GitHub, and file operations
- Better streaming/status events
- Richer CLI formatting
- Automated tests
- Multi-agent workflows
