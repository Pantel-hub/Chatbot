# openAI_assistant_helper.py

import json
from typing import Optional, Dict
from database_connection import get_db


async def create_assistant_config(
    chatbot_id: int,
    assistant_id: str, 
    vector_store_id: str, 
    file_ids: Optional[Dict] = None
) -> int:
    """
    Δημιουργεί νέο assistant config για chatbot
    """
    async with get_db() as conn:
        async with conn.cursor() as cursor:
            await cursor.execute("""
                INSERT INTO assistant_configs 
                (chatbot_id, assistant_id, vector_store_id, openai_file_ids)
                VALUES (%s, %s, %s, %s)
            """, (
                chatbot_id,
                assistant_id,
                vector_store_id,
                json.dumps(file_ids or {})
            ))
            await conn.commit()
            return cursor.lastrowid


async def get_assistant_config(chatbot_id: int) -> Optional[Dict]:
    """
    Παίρνει assistant config για chatbot
    """
    async with get_db() as conn:
        async with conn.cursor() as cursor:
            await cursor.execute("""
                SELECT * FROM assistant_configs 
                WHERE chatbot_id = %s
            """, (chatbot_id,))
            return await cursor.fetchone()


async def get_assistant_config_by_api_key(api_key: str) -> Optional[Dict]:
    """
    Παίρνει assistant config μέσω api_key (για widget chat)
    """
    async with get_db() as conn:
        async with conn.cursor() as cursor:
            await cursor.execute("""
                SELECT ac.* 
                FROM assistant_configs ac
                JOIN companies c ON c.id = ac.chatbot_id
                WHERE c.api_key = %s
            """, (api_key,))
            return await cursor.fetchone()


async def update_assistant_config(chatbot_id: int, **updates) -> bool:
    """
    Ενημερώνει assistant config
    
    Example:
        await update_assistant_config(
            chatbot_id=1,
            assistant_id="asst_new123",
            openai_file_ids={"website": "file-abc"}
        )
    """
    async with get_db() as conn:
        async with conn.cursor() as cursor:
            # Handle JSON fields
            processed_updates = {}
            for key, value in updates.items():
                if key == 'openai_file_ids' and isinstance(value, dict):
                    processed_updates[key] = json.dumps(value)
                else:
                    processed_updates[key] = value
            
            # Build dynamic UPDATE query
            set_clause = ", ".join([f"{key} = %s" for key in processed_updates.keys()])
            values = list(processed_updates.values())
            values.append(chatbot_id)
            
            await cursor.execute(f"""
                UPDATE assistant_configs 
                SET {set_clause}
                WHERE chatbot_id = %s
            """, values)
            await conn.commit()
            return cursor.rowcount > 0


async def delete_assistant_config(chatbot_id: int) -> bool:
    """
    Διαγράφει assistant config (για cleanup)
    """
    async with get_db() as conn:
        async with conn.cursor() as cursor:
            await cursor.execute("""
                DELETE FROM assistant_configs 
                WHERE chatbot_id = %s
            """, (chatbot_id,))
            await conn.commit()
            return cursor.rowcount > 0
