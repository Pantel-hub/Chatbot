import os
import pymysql
import logging
from datetime import datetime, date
from dotenv import load_dotenv

from redis_helper import get_redis_connection, redis_client


load_dotenv()


# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# database connection
def get_database_connection():
    """Σύνδεση στη MySQL"""
    conn = pymysql.connect(
        host=os.getenv("MYSQL_HOST", "localhost"),
        port=int(os.getenv("MYSQL_PORT", 3307)),
        user=os.getenv("MYSQL_USER", "root"),
        password=os.getenv("MYSQL_PASSWORD", "MyAnalytics2024!"),
        database=os.getenv("MYSQL_DATABASE", "chatbot_platform"),
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
    )
    return conn


def migrate_daily_analytics():
    """
    Μεταφέρει σημερινά δεδομένα από Redis στη MySQL και καθαρίζει το Redis.
    Τρέχει μετά τα μεσάνυχτα (π.χ. 00:05) για να αποθηκεύσει τα data της προηγούμενης ημέρας.
    """
    redis_conn = redis_client
    mysql_conn = get_database_connection()

    try:
        cursor = mysql_conn.cursor()

        # Η ημερομηνία που αποθηκεύουμε είναι ΧΘΕΣ (γιατί τρέχει μετά τα μεσάνυχτα)
        from datetime import timedelta

        migration_date = date.today() - timedelta(days=1)

        logger.info(f"Starting migration for date: {migration_date}")

        # Βρες όλες τις ενεργές εταιρείες (μόνο api_key)
        cursor.execute("SELECT api_key,companyName FROM companies")
        companies = cursor.fetchall()

        logger.info(f"Found {len(companies)} companies to migrate")

        for company in companies:
            api_key = company["api_key"]
            company_name = company["companyName"]
            logger.info(f"Processing api_key: {api_key} for company: {company_name}")

            # ==================== ΔΙΑΒΑΣΜΑ ΑΠΟ REDIS ====================

            # 1. stats:{api_key}
            redis_stats = redis_conn.hgetall(f"stats:{api_key}")

            total_messages = int(redis_stats.get("total_messages", 0))
            user_messages = int(redis_stats.get("total_user_messages", 0))
            assistant_messages = int(redis_stats.get("total_assistant_messages", 0))
            total_sessions = int(redis_stats.get("total_sessions", 0))
            last_message_at = redis_stats.get("last_message_at")  # ISO string ή None

            # 2. ratings:{api_key}
            redis_ratings = redis_conn.hgetall(f"ratings:{api_key}")

            ratings_sum = int(redis_ratings.get("sum", 0))
            ratings_count = int(redis_ratings.get("count", 0))

            # 3. response_stats:{api_key}
            redis_response = redis_conn.hgetall(f"response_stats:{api_key}")

            daily_response_time_sum = float(redis_response.get("total_time", 0))
            daily_avg_response_time = float(redis_response.get("avg", 0))

            # Υπολογισμός daily_avg_rating
            daily_avg_rating = ratings_sum / ratings_count if ratings_count > 0 else 0

            # Skip αν δεν υπάρχουν data
            if total_messages == 0:
                logger.info(f"No data for {api_key}, skipping")
                continue

            logger.info(
                f"  Messages: {total_messages}, Sessions: {total_sessions}, Avg Response: {daily_avg_response_time:.2f}s"
            )

            # ==================== DAILY ANALYTICS INSERT ====================

            daily_insert_sql = """
            INSERT INTO daily_analytics 
            (api_key, date,company_name, daily_total_messages, daily_user_messages, daily_assistant_messages,
             daily_total_sessions, daily_ratings_sum, daily_ratings_count, 
             daily_avg_response_time, daily_avg_rating, daily_response_time_sum)
            VALUES (%s, %s,%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                company_name = VALUES(company_name),
                daily_total_messages = VALUES(daily_total_messages),
                daily_user_messages = VALUES(daily_user_messages),
                daily_assistant_messages = VALUES(daily_assistant_messages),
                daily_total_sessions = VALUES(daily_total_sessions),
                daily_ratings_sum = VALUES(daily_ratings_sum),
                daily_ratings_count = VALUES(daily_ratings_count),
                daily_avg_response_time = VALUES(daily_avg_response_time),
                daily_avg_rating = VALUES(daily_avg_rating),
                daily_response_time_sum = VALUES(daily_response_time_sum)
            """

            cursor.execute(
                daily_insert_sql,
                (
                    api_key,
                    migration_date,
                    company_name,
                    total_messages,
                    user_messages,
                    assistant_messages,
                    total_sessions,
                    ratings_sum,
                    ratings_count,
                    daily_avg_response_time,
                    daily_avg_rating,
                    daily_response_time_sum,
                ),
            )

            # ==================== TOTAL ANALYTICS UPDATE ====================

            # ==================== TOTAL ANALYTICS UPSERT ====================

            total_upsert_sql = """
                INSERT INTO total_analytics 
                (api_key,company_name, total_messages, total_user_messages, total_assistant_messages,
                total_sessions, total_ratings_sum, total_ratings_count, 
                total_response_time_sum, last_updated)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    company_name = VALUES(company_name),
                    total_messages = total_messages + VALUES(total_messages),
                    total_user_messages = total_user_messages + VALUES(total_user_messages),
                    total_assistant_messages = total_assistant_messages + VALUES(total_assistant_messages),
                    total_sessions = total_sessions + VALUES(total_sessions),
                    total_ratings_sum = total_ratings_sum + VALUES(total_ratings_sum),
                    total_ratings_count = total_ratings_count + VALUES(total_ratings_count),
                    total_response_time_sum = total_response_time_sum + VALUES(total_response_time_sum),
                    last_updated = VALUES(last_updated)
                """

            cursor.execute(
                total_upsert_sql,
                (
                    api_key,
                    company_name,
                    total_messages,
                    user_messages,
                    assistant_messages,
                    total_sessions,
                    ratings_sum,
                    ratings_count,
                    daily_response_time_sum,
                    migration_date,
                ),
            )

            logger.info(f"  ✅ MySQL updated for {api_key}")

        # ==================== COMMIT ΟΛΑ ΜΑΖΙ ====================
        mysql_conn.commit()
        logger.info("✅ All database changes committed successfully")

        # ==================== CLEANUP REDIS ====================
        logger.info("Starting Redis cleanup...")
        cleanup_redis(redis_conn, companies)

    except Exception as e:
        logger.error(f"❌ Migration failed: {e}")
        mysql_conn.rollback()
        raise
    finally:
        mysql_conn.close()
        logger.info("Migration process finished")


def cleanup_redis(redis_client, companies):
    """
    Καθαρίζει μόνο τα στατιστικά δεδομένα από το Redis.
    Τα sessions και άλλα ενεργά δεδομένα παραμένουν.
    """
    for company in companies:
        api_key = company["api_key"]

        # Διαγραφή μόνο στατιστικών counters
        redis_client.delete(f"stats:{api_key}")
        redis_client.delete(f"ratings:{api_key}")
        redis_client.delete(f"response_stats:{api_key}")

        logger.info(f"  🧹 Cleaned Redis stats for {api_key}")

    logger.info("✅ Redis cleanup completed")


if __name__ == "__main__":
    migrate_daily_analytics()
