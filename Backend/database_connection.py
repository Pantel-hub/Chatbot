"""
Database connection pool management για MySQL
"""
import aiomysql
from aiomysql import cursors
import logging
import os
## Δημιουργεί ασύγχρονο context manager για ασφαλή διαχείριση σύνδεσης στη βάση
from contextlib import asynccontextmanager
from fastapi import HTTPException
import asyncio 

logger = logging.getLogger(__name__)

# Global pool μεταβλητή
_db_pool = None


async def init_db_pool():
    """
    Δημιουργεί connection pool κατά το startup.
    Καλείται από main.py στο startup event.
    """
    global _db_pool

    ## Έλεγχος αν το connection pool έχει ήδη δημιουργηθεί, για να αποφευχθεί διπλή αρχικοποίηση
    if _db_pool is not None:
        logger.warning("⚠️ Database pool already initialized")
        return
    
    try:
        #δημιουργεί connection pool με την sql
        _db_pool = await aiomysql.create_pool(
            host=os.getenv('MYSQL_HOST', 'localhost'),
            port=int(os.getenv('MYSQL_PORT', 3307)),
            user=os.getenv('MYSQL_USER', 'root'),
            password=os.getenv('MYSQL_PASSWORD', ''),
            db=os.getenv('MYSQL_DATABASE', 'chatbot_platform'),
            charset='utf8mb4',  #encoding
            cursorclass=cursors.DictCursor, #παίρνω λεξικά μετά από query στην βάση
            minsize=2,      # Minimum connections στο pool
            maxsize=100,     # Maximum connections
            autocommit=False,#δεν αποθηκευεί αυτόματα τις αλλαγές στην βάση
            pool_recycle=3600  # Recycle connections(αδρανείς) μετά από 1 ώρα
        )
        logger.info("✅ Database connection pool created successfully")
    except Exception as e:
        logger.error(f"❌ Failed to create database pool: {e}")
        raise

#αν γίνει κλείσιμο της εφαρμογης , κελίνει την σύνδεση 
async def close_db_pool():
    """
    Κλείνει το connection pool με timeout για graceful shutdown
    """
    global _db_pool
    
    if _db_pool is None:
        logger.warning("⚠️ Database pool not initialized")
        return
    
    try:
        logger.info("🔄 Closing database pool...")  # ✅ ΠΡΟΣΘΗΚΗ
        _db_pool.close()
        
        # ✅ ΠΡΟΣΘΗΚΗ - Timeout 5 δευτερόλεπτα
        await asyncio.wait_for(_db_pool.wait_closed(), timeout=5.0)
        
        logger.info("✅ Database connection pool closed gracefully")  # ✅ ΑΛΛΑΓΗ
        _db_pool = None
        
    except asyncio.TimeoutError:  # ✅ ΠΡΟΣΘΗΚΗ - Νέο except block
        logger.warning("⚠️ Database pool close timeout - forcing terminate")
        _db_pool.terminate()
        await _db_pool.wait_closed()
        _db_pool = None
        
    except Exception as e:
        logger.error(f"❌ Error closing database pool: {e}")
        _db_pool = None  # ✅ ΠΡΟΣΘΗΚΗ - Reset pool

#τραβάει” μία σύνδεση από το pool κάθε φορά που χρειάζεται η εφαρμογή σου να επικοινωνήσει με την βάση.
async def get_database_connection():
    if _db_pool is None:
        logger.error("❌ Database pool not initialized")
        raise HTTPException(
            status_code=503,
            detail="Database service unavailable"
        )
    
    try:
        conn = await _db_pool.acquire() #παίρνει μία σύνδεση
        return conn
    except Exception as e:
        logger.error(f"❌ Failed to acquire database connection: {e}")
        raise HTTPException(
            status_code=503,
            detail="Failed to connect to database"
        )


@asynccontextmanager
async def get_db():
    """
    Context manager για αυτόματο cleanup.
    
    Χρήση (προτεινόμενο):
        async with get_db() as conn:
            async with conn.cursor() as cursor:
                await cursor.execute("SELECT * FROM users")
                result = await cursor.fetchone()
            await conn.commit()
    """
    conn = await get_database_connection()
    try:
        yield conn
    except Exception as e:
        await conn.rollback()
        logger.error(f"❌ Database operation failed: {e}")
        raise
    finally:
        try:
            if not conn.closed:
                await _db_pool.release(conn)  # ✅ επιστροφή στο pool, ΟΧΙ close()
        except Exception as e:
            logger.warning(f"⚠️ Failed to release DB connection: {e}")
