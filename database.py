import sqlite3

conn = sqlite3.connect("nova_ai.db", check_same_thread=False)

cursor = conn.cursor()

cursor.execute("""
CREATE TABLE IF NOT EXISTS chats(

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    user_message TEXT,

    ai_reply TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP

)
""")

conn.commit()


def save_chat(user_message, ai_reply):

    cursor.execute(

        "INSERT INTO chats(user_message, ai_reply) VALUES(?,?)",

        (user_message, ai_reply)

    )

    conn.commit()


def get_history():

    cursor.execute("""

    SELECT user_message, ai_reply

    FROM chats

    ORDER BY id DESC

    LIMIT 50

    """)

    return cursor.fetchall()