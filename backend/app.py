from database import save_chat, get_history
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from chatbot import get_reply

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def home():
    return {
        "message": "🤖 AI Cloud Chatbot Backend Running Successfully!"
    }

@app.post("/chat")
def chat(data: dict):

    message = data.get("message", "")

    reply = get_reply(message)

    save_chat(message, reply)

    return {
        "reply": reply
    }
@app.get("/history")
def history():

    return {

        "history": get_history()

    }
