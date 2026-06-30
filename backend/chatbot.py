from google import genai
from dotenv import load_dotenv
import os

load_dotenv()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# Stores conversation in memory
conversation = []

SYSTEM_PROMPT = """
You are Nova AI.

You are a professional AI assistant specialized in:
- Cloud Computing
- Python
- FastAPI
- Programming
- AI
- Data Science

Always reply in a friendly, professional and concise way.

Remember previous messages in the conversation.
"""

def get_reply(message: str):

    global conversation

    conversation.append(f"User: {message}")

    # Keep only last 10 messages
    conversation = conversation[-10:]

    prompt = SYSTEM_PROMPT + "\n\n"

    prompt += "\n".join(conversation)

    try:

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt
        )

        reply = response.text

        conversation.append(f"Nova AI: {reply}")

        conversation = conversation[-10:]

        return reply

    except Exception as e:
        return f"Error: {e}"