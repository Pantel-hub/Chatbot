import json
import os
import time
import logging
import anyio
from typing import Dict, Any, Optional, List
from tempfile import NamedTemporaryFile
from datetime import datetime, timezone

from openai import OpenAI, AsyncOpenAI

from database_connection import get_db


async_openai_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
logger = logging.getLogger(__name__)

# ✅ Προσθήκη αυτών των 3 γραμμών
print("=" * 50)
print(f"🔑 OPENAI_API_KEY exists: {bool(os.getenv('OPENAI_API_KEY'))}")
print(f"🔑 openai_client type: {type(openai_client)}")
print(f"🔑 Has .beta attribute: {hasattr(openai_client, 'beta')}")
if hasattr(openai_client, "beta"):
    print(f"🔑 Has .beta.vector_stores: {hasattr(openai_client.beta, 'vector_stores')}")
print("=" * 50)


###Προσαρμοσμένη Εξαίρεση για Αποτυχία Επεξεργασίας files δεδομένων ###
class KnowledgeProcessingError(Exception):
    """Custom exception for knowledge processing failures."""

    pass


# αποθηκευω στην βάση vector,files ids με τα files ids να αποθηκευονται σε μορφή json
async def create_assistant_config(
    conn,
    chatbot_id: int,
    api_key: str,
    assistant_id: str,
    vector_store_id: str,
    file_ids: dict = None,
) -> int:

    async with conn.cursor() as cursor:
        await cursor.execute(
            """
            INSERT INTO assistant_configs 
            (chatbot_id, api_key, assistant_id, vector_store_id, openai_file_ids)
            VALUES (%s, %s, %s, %s, %s)
        """,
            (
                chatbot_id,
                api_key,
                assistant_id,
                vector_store_id,
                json.dumps(file_ids or {}),
            ),
        )

        return cursor.lastrowid


###Blocking ###


def process_knowledge_blocking(
    company_name: str,
    website_data: Optional[str],
    # Τα files έρχονται ως List[tuple] από το cms_routes: [(filename, temp_path), ...]
    local_file_paths: List[Dict[str, str]],
) -> Dict[str, Any]:
    """
    Δημιουργεί Vector Store, ανεβάζει website data (μέσω temp file) και files.
    Είναι BLOCKING - πρέπει να καλείται με to_thread.run_sync.
    Επιστρέφει vector_store_id και openai_file_ids.
    """
    # μια λίστα από λεξικά οπου θα αποθηκευονται ολα τα αρχεια που θα ανεβουν στο vector store
    all_file_paths = []

    # Αρχικοποιηση μεταβλητης για προσωρινο αρχείο website_data.txt
    temp_website_file_path = None

    try:
        # ------------------- 1. Δημιουργία Προσωρινού Αρχείου (Website Data) -------------------
        if website_data:
            logger.info("Starting temp file creation for website data.")
            # Χρησιμοποιούμε NamedTemporaryFile
            with NamedTemporaryFile(
                mode="w+t",
                delete=False,  # Το αφήνουμε ανοιχτό/προσβάσιμο μέχρι το finally block
                suffix=".txt",
                encoding="utf-8",
            ) as tmp:
                tmp.write(website_data)  # βάζω τα website_data σε ένα αρχείο txt

            tmp.close()

            # διαβάζει την πλήρη διαδρομή string του προσωρίνου αρχειου και την αποθηκευει στην
            # μεταβλητη temp_website_file_path
            temp_website_file_path = tmp.name

            # Προσθήκη στη λίστα upload
            all_file_paths.append(
                {
                    "path": temp_website_file_path,
                    "type": "website",
                    "filename_key": "website_data",
                }
            )
            logger.info(f"Created temp website file: {temp_website_file_path}")

        # ------------------- 2. Προσθήκη Local Files (αρχείων χρήστη) -------------------
        # Τα local_file_paths έρχονται από το cms_routes (αρχεία χρήστη)
        all_file_paths.extend(local_file_paths)

        # ------------------- 3. Δημιουργία Vector Store -------------------

        if not all_file_paths:
            logger.warning("No knowledge data provided for Vector Store.")
            # Ακόμη κι αν δεν υπάρχουν αρχεία, δημιουργούμε το Vector Store
            # για μελλοντική χρήση.
            vector_store = openai_client.beta.vector_stores.create(
                name=f"{company_name} Knowledge Store"
            )
            return {"vector_store_id": vector_store.id, "openai_file_ids": {}}

        # δημιουργεί το vector store
        vector_store = openai_client.beta.vector_stores.create(
            name=f"{company_name} Knowledge Store"
        )
        logger.info(f"Vector Store created: {vector_store.id}")

        # ------------------- 4. Upload Files στο Vector Store -------------------

        openai_file_ids_map = {}  # λεξικο με file_name:openai_file_id
        upload_file_ids = (
            []
        )  # λίστα με τα αναγνωριστικά ids των αρχείων το χρειαζεται η openai για το indexing

        # 4.1 Upload files to OpenAI
        failed_uploads = []
        for file_info in all_file_paths:
            file_path = file_info["path"]
            filename_key = file_info["filename_key"]  # όνομα του αρχείου

            # Χρησιμοποιούμε context manager για ασφαλή κλήση του open()
            try:
                with open(file_path, "rb") as f:
                    uploaded_file = openai_client.files.create(
                        file=f, purpose="assistants"
                    )

                openai_file_ids_map[filename_key] = (
                    uploaded_file.id
                )  # αφου έχει ανεβει και έχει αποκτήσει id

                upload_file_ids.append(uploaded_file.id)
                logger.info(
                    f"File uploaded to OpenAI: {filename_key} -> {uploaded_file.id}"
                )

            except Exception as e:
                logger.warning(f"⚠️ Failed to upload {filename_key}: {e}")
                failed_uploads.append({"filename": filename_key, "error": str(e)})
                continue

        if failed_uploads:
            logger.warning(f"⚠️ {len(failed_uploads)} file(s) failed to upload")
        if upload_file_ids:
            logger.info(f"✅ {len(upload_file_ids)} file(s) uploaded successfully")

        if not upload_file_ids:
            logger.warning(
                "⚠️ No files were successfully uploaded to add to Vector Store"
            )
            return {
                "vector_store_id": vector_store.id,
                "openai_file_ids": {},
                "failed_uploads": failed_uploads,
            }

        # 4.2 Προσθήκη των uploaded files στο Vector Store και indexing
        openai_client.beta.vector_stores.file_batches.create_and_poll(
            vector_store_id=vector_store.id, file_ids=upload_file_ids
        )
        logger.info(f"All files added and processed by Vector Store: {vector_store.id}")

        # ------------------- 5. Επιστροφή Αποτελεσμάτων -------------------
        # φτίαχνει ένα λεξικό (μετατροπη σε json) όπου θα έχει πληροφορίες για τα αρχεία που ανέβηκαν
        # για να τα αποθηκεύσω στην βάση
        structured_file_ids = {}
        for filename_key, file_id in openai_file_ids_map.items():
            if filename_key == "website_data":
                structured_file_ids[filename_key] = {
                    "file_id": file_id,
                    "filename": "website_data.txt",
                    "type": "website",
                }
            elif filename_key == "faq_data":
                structured_file_ids[filename_key] = {
                    "file_id": file_id,
                    "filename": "faq_data.txt",
                    "type": "faq",
                    "uploaded_at": datetime.now(timezone.utc).isoformat(),
                }
            else:
                structured_file_ids[filename_key] = {
                    "file_id": file_id,
                    "filename": filename_key,
                    "type": "user_file",
                    "uploaded_at": datetime.now(timezone.utc).isoformat(),
                }

        return {
            "vector_store_id": vector_store.id,
            "openai_file_ids": structured_file_ids,
            "failed_uploads": failed_uploads,
        }

    except Exception as e:
        logger.error(f"❌ OpenAI API or File Error: {e}")
        raise KnowledgeProcessingError(
            f"Failed to process knowledge data with OpenAI: {e}"
        )

    finally:
        # ------------------- 6. Τελική Διαγραφή Προσωρινού Αρχείου Website -------------------
        if temp_website_file_path and os.path.exists(temp_website_file_path):
            try:
                os.unlink(temp_website_file_path)
                logger.info(
                    f"✅ Deleted temporary website file: {temp_website_file_path}"
                )
            except Exception as e:
                logger.warning(
                    f"⚠️ Failed to delete temporary file {temp_website_file_path}: {e}"
                )


### ενημέρωση υπάρχοντος vector store ###
def update_vector_store_blocking(
    vector_store_id: str,
    existing_file_ids: dict,
    website_data: Optional[str],
    local_file_paths: List[Dict[str, str]],
    update_website: bool = False,
    update_faq: bool = False,
    faq_text: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Ενημερώνει υπάρχον Vector Store με νέα files/website data.
    Είναι BLOCKING - πρέπει να καλείται με to_thread.run_sync.

    """
    temp_website_file_path = None
    temp_faq_file_path = None
    existing_file_ids = existing_file_ids or {}
    updated_file_ids = existing_file_ids.copy()  # αντιγραφο του existing files ids

    try:
        # ------------------- 1. Διαχείριση Website Data -------------------
        if update_website and website_data:
            logger.info("🔄 Updating website data...")

            # Διαγραφή παλιού website file (αν υπάρχει)
            if "website_data" in existing_file_ids:
                old_file_id = existing_file_ids["website_data"]["file_id"]
                try:
                    # Διαγραφή από Vector Store
                    openai_client.beta.vector_stores.files.delete(
                        vector_store_id=vector_store_id, file_id=old_file_id
                    )
                    logger.info(
                        f"🗑️ Deleted old website file from Vector Store: {old_file_id}"
                    )

                    # Διαγραφή από OpenAI
                    openai_client.files.delete(old_file_id)
                    logger.info(
                        f"🗑️ Deleted old website file from OpenAI: {old_file_id}"
                    )
                except Exception as e:
                    logger.warning(f"⚠️ Failed to delete old website file: {e}")

            # Δημιουργία νέου temp file
            with NamedTemporaryFile(
                mode="w+t", delete=False, suffix=".txt", encoding="utf-8"
            ) as tmp:
                tmp.write(website_data)

            tmp.close()
            temp_website_file_path = tmp.name

            # Upload νέου file
            with open(temp_website_file_path, "rb") as f:
                new_website_file = openai_client.files.create(
                    file=f, purpose="assistants"
                )

            # Προσθήκη στο Vector Store
            openai_client.beta.vector_stores.files.create(
                vector_store_id=vector_store_id, file_id=new_website_file.id
            )

            # Update το dictionary
            updated_file_ids["website_data"] = {
                "file_id": new_website_file.id,
                "filename": "website_data.txt",
                "type": "website",
            }

            logger.info(f"✅ Website data updated: {new_website_file.id}")

        # ------------------- 2. Διαχείριση faq data -------------------
        if update_faq and faq_text:
            logger.info("🔄 Updating FAQ data...")

            if "faq_data" in existing_file_ids:
                old_faq_file_id = existing_file_ids["faq_data"]["file_id"]
                try:
                    # Διαγραφή από Vector Store
                    openai_client.beta.vector_stores.files.delete(
                        vector_store_id=vector_store_id, file_id=old_faq_file_id
                    )
                    logger.info(
                        f"🗑️ Deleted old FAQ file from Vector Store: {old_faq_file_id}"
                    )

                    openai_client.files.delete(old_faq_file_id)
                    logger.info(
                        f"🗑️ Deleted old FAQ file from OpenAI: {old_faq_file_id}"
                    )
                except Exception as e:
                    logger.warning(f"⚠️ Failed to delete old FAQ file: {e}")

            with NamedTemporaryFile(
                mode="w+t", delete=False, suffix=".txt", encoding="utf-8"
            ) as tmp_faq:
                tmp_faq.write(faq_text)
            tmp_faq.close()
            temp_faq_file_path = tmp_faq.name

            # Upload νέου FAQ file
            with open(temp_faq_file_path, "rb") as f:
                new_faq_file = openai_client.files.create(file=f, purpose="assistants")

            # Προσθήκη στο Vector Store
            openai_client.beta.vector_stores.files.create(
                vector_store_id=vector_store_id, file_id=new_faq_file.id
            )

            # Update το dictionary
            updated_file_ids["faq_data"] = {
                "file_id": new_faq_file.id,
                "filename": "faq_data.txt",
                "type": "faq",
                "uploaded_at": datetime.now(timezone.utc).isoformat(),
            }

            logger.info(f"✅ FAQ data updated: {new_faq_file.id}")
        elif update_faq and not faq_text:
            logger.warning(
                "⚠️ update_faq=True αλλά δεν δόθηκε faq_text — skip FAQ update."
            )

        # ------------------- 3. Διαχείριση User Files -------------------
        if local_file_paths:
            logger.info(f"📤 Uploading {len(local_file_paths)} new user files...")

            for file_info in local_file_paths:
                file_path = file_info["path"]
                filename_key = file_info["filename_key"]
                if filename_key in ("website_data", "faq_data"):
                    logger.info(
                        f"⏭️ Skipping {filename_key} — already handled separately."
                    )
                    continue

                # Upload file
                with open(file_path, "rb") as f:
                    uploaded_file = openai_client.files.create(
                        file=f, purpose="assistants"
                    )

                # Προσθήκη στο Vector Store
                openai_client.beta.vector_stores.files.create(
                    vector_store_id=vector_store_id, file_id=uploaded_file.id
                )

                # Προσθήκη στο dictionary
                updated_file_ids[filename_key] = {
                    "file_id": uploaded_file.id,
                    "filename": filename_key,
                    "type": "user_file",
                    "uploaded_at": datetime.now(timezone.utc).isoformat(),
                }

                logger.info(f"✅ File uploaded: {filename_key} -> {uploaded_file.id}")

        # ------------------- 3. Επιστροφή -------------------
        logger.info(f"✅ Vector Store updated successfully: {vector_store_id}")

        return {"vector_store_id": vector_store_id, "openai_file_ids": updated_file_ids}

    except Exception as e:
        logger.error(f"❌ Vector Store update failed: {e}")
        raise KnowledgeProcessingError(f"Failed to update Vector Store: {e}")

    finally:
        # Cleanup temp website file
        if temp_website_file_path and os.path.exists(temp_website_file_path):
            try:
                os.unlink(temp_website_file_path)
                logger.info(f"🧹 Deleted temp website file")
            except Exception as e:
                logger.warning(f"⚠️ Failed to delete temp file: {e}")

        if temp_faq_file_path and os.path.exists(temp_faq_file_path):
            try:
                os.unlink(temp_faq_file_path)
                logger.info("🧹 Deleted temp FAQ file")
            except Exception as e:
                logger.warning(f"⚠️ Failed to delete temp FAQ file: {e}")


### δυνατότητα του χρήστη να διαγραψει αρχεία που έχει ανεβάσει ###
def delete_file_from_vector_store_blocking(vector_store_id: str, file_id: str) -> bool:
    """
    Args:
        vector_store_id: Το Vector Store ID
        file_id: Το OpenAI file ID προς διαγραφή

    Returns:
        True αν επιτυχής, False αν αποτυχία
    """
    try:
        # 1. Διαγραφή από Vector Store
        openai_client.beta.vector_stores.files.delete(
            vector_store_id=vector_store_id, file_id=file_id
        )
        logger.info(f"🗑️ File removed from Vector Store: {file_id}")

        # 2. Διαγραφή από OpenAI
        openai_client.files.delete(file_id)
        logger.info(f"🗑️ File deleted from OpenAI: {file_id}")

        return True

    except Exception as e:
        logger.error(f"❌ Failed to delete file {file_id}: {e}")
        return False


# σκοπός να δημιουργει assistant και να τον συνδέει με το vector store της εταιρίας
async def create_assistant_async(
    company_name: str, api_key: str, system_prompt: str, vector_store_id: str
) -> str:
    try:
        assistant = await async_openai_client.beta.assistants.create(
            name=f"{company_name} - {api_key}",
            instructions=system_prompt,
            model="gpt-4o",
            tools=[{"type": "file_search"}],
            tool_resources={"file_search": {"vector_store_ids": [vector_store_id]}},
        )

        logger.info(f"✅ Assistant created: {assistant.id}")
        return assistant.id

    except Exception as e:
        logger.error(f"❌ Failed to create Assistant: {e}")
        raise KnowledgeProcessingError(f"Failed to create Assistant: {e}")


# Προσθήκη στο AI_assistant_helper.py


async def get_or_create_thread(thread_id: Optional[str] = None) -> str:
    """
    Δημιουργεί ή επιστρέφει ένα thread ID.

    Args:
        thread_id: Υπάρχον thread ID (optional)

    Returns:
        str: Thread ID

    """
    try:
        if thread_id:
            # Έλεγχος αν υπάρχει το thread
            try:
                await async_openai_client.beta.threads.retrieve(thread_id)
                logger.info(f"✅ Using existing thread: {thread_id}")
                return thread_id
            except Exception as e:
                # Thread δεν βρέθηκε → δημιουργία νέου
                logger.warning(f"⚠️ Thread {thread_id} not found, creating new one: {e}")

        # Δημιουργία νέου thread
        thread = await async_openai_client.beta.threads.create()
        logger.info(f"✅ Created new thread: {thread.id}")
        return thread.id

    except Exception as e:
        logger.error(f"❌ Failed to get/create thread: {e}")
        raise Exception(f"Thread management failed: {e}")


async def add_message_to_thread(
    thread_id: str, message: str, role: str = "user"
) -> str:
    """
    Προσθέτει μήνυμα σε ένα thread.

    Args:
        thread_id: Το ID του thread
        message: Το περιεχόμενο του μηνύματος
        role: "user" ή "assistant"

    Returns:
        str: Message ID

    Raises:
        Exception: Αν αποτύχει η προσθήκη μηνύματος
    """
    try:
        # δημιουργεί ένα message object στο thread
        thread_message = await async_openai_client.beta.threads.messages.create(
            thread_id=thread_id, role=role, content=message
        )
        logger.info(
            f"✅ Added {role} message to thread {thread_id}: {thread_message.id}"
        )
        return thread_message.id

    except Exception as e:
        logger.error(f"❌ Failed to add message to thread {thread_id}: {e}")
        raise Exception(f"Failed to add message: {e}")


async def run_assistant_on_thread(thread_id: str, assistant_id: str):
    """
    Τρέχει τον assistant σε ένα thread με streaming.

    Args:
        thread_id: Το ID του thread
        assistant_id: Το ID του assistant

    Yields:
        str: Text chunks από την απάντηση του assistant

    Raises:
        Exception: Αν αποτύχει η εκτέλεση του assistant
    """
    try:
        logger.info(f"🤖 Running assistant {assistant_id} on thread {thread_id}")

        async with async_openai_client.beta.threads.runs.stream(
            thread_id=thread_id, 
            assistant_id=assistant_id, 
            temperature=0.2,
            top_p=0.9,
        ) as stream:
            async for event in stream:
                # Streaming events από το OpenAI
                # αν ειναι κομματι απάντησης
                if event.event == "thread.message.delta":
                    if hasattr(event.data, "delta") and hasattr(
                        event.data.delta, "content"
                    ):
                        for content_block in event.data.delta.content:
                            if hasattr(content_block, "text") and hasattr(
                                content_block.text, "value"
                            ):
                                yield content_block.text.value

                elif event.event == "thread.run.failed":
                    logger.error(f"❌ Assistant run failed: {event.data}")
                    raise Exception(f"Assistant run failed: {event.data.last_error}")

                elif event.event == "thread.run.completed":
                    logger.info(f"✅ Assistant run completed for thread {thread_id}")

    except Exception as e:
        logger.error(f"❌ Failed to run assistant on thread {thread_id}: {e}")
        raise Exception(f"Assistant execution failed: {e}")


### Για το widget ###
# παίρνει το assistant_id από το api_key της εταιρίας
async def get_assistant_id_by_api_key(api_key: str) -> Optional[str]:
    try:
        async with get_db() as conn:
            async with conn.cursor() as cursor:
                await cursor.execute(
                    "SELECT assistant_id FROM assistant_configs WHERE api_key = %s",
                    (api_key,),
                )
                row = await cursor.fetchone()

                if row:
                    logger.info(f"✅ Found assistant_id for api_key:{api_key[:10]}")
                    return row["assistant_id"]

                logger.warning(f"⚠️ No assistant found for api_key: {api_key[:10]}...")
                return None

    except Exception as e:
        logger.error(f"❌ Failed to get assistant_id for api_key: {e}")
        return None


### Διαγραφή Thread για Test Sessions ###
async def delete_thread_async(thread_id: str) -> bool:
    """Διαγράφει ένα thread από το OpenAI API."""
    try:
        await async_openai_client.beta.threads.delete(thread_id)
        logger.info(f"🗑️ Successfully deleted thread: {thread_id}")
        return True

    except Exception as e:
        # Αν το thread δεν υπάρχει ή άλλο error, δεν κάνουμε crash
        logger.warning(f"⚠️ Failed to delete thread {thread_id}: {e}")
        return False
