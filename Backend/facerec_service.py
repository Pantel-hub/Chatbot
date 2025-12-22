"""
Face Recognition Service using DeepFace
Handles face registration, verification, and authentication
"""

import numpy as np
from deepface import DeepFace
from typing import Optional, Dict, Any, Tuple
import base64
import io
from PIL import Image
import json
import pickle
import logging
from database_connection import get_db

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Model configuration
FACE_MODEL = "Facenet512"  # High accuracy model, 512-dimensional embeddings
DETECTOR_BACKEND = "opencv"  # Fast and reliable detector
DISTANCE_METRIC = "cosine"  # Cosine similarity for face comparison
VERIFICATION_THRESHOLD = 0.4  # Threshold for face matching (lower = stricter)


class FaceRecognitionService:
    """Service for face recognition operations"""

    def __init__(self):
        self.model = FACE_MODEL
        self.detector = DETECTOR_BACKEND
        self.distance_metric = DISTANCE_METRIC

    def decode_base64_image(self, base64_string: str) -> np.ndarray:
        """
        Decode base64 image string to numpy array

        Args:
            base64_string: Base64 encoded image string

        Returns:
            numpy array of the image
        """
        try:
            # Remove data URL prefix if present
            if "," in base64_string:
                base64_string = base64_string.split(",")[1]

            # Decode base64 string
            img_data = base64.b64decode(base64_string)
            img = Image.open(io.BytesIO(img_data))

            # Convert to RGB if necessary
            if img.mode != "RGB":
                img = img.convert("RGB")

            # Convert to numpy array
            img_array = np.array(img)
            return img_array

        except Exception as e:
            logger.error(f"Error decoding base64 image: {e}")
            raise ValueError(f"Invalid image data: {str(e)}")

    def extract_face_embedding(
        self, image_data: str
    ) -> Tuple[np.ndarray, Dict[str, Any]]:
        """
        Extract face embedding from base64 image

        Args:
            image_data: Base64 encoded image string

        Returns:
            Tuple of (embedding vector, face detection info)
        """
        try:
            # Decode image
            img_array = self.decode_base64_image(image_data)

            # Extract embedding using DeepFace
            embedding_objs = DeepFace.represent(
                img_path=img_array,
                model_name=self.model,
                detector_backend=self.detector,
                enforce_detection=True,  # Ensure face is detected
                align=True,  # Align face for better accuracy
            )

            if not embedding_objs or len(embedding_objs) == 0:
                raise ValueError("Could not detect a face, try again please")

            # Get first face (primary face in image)
            embedding_obj = embedding_objs[0]
            embedding = np.array(embedding_obj["embedding"])

            # Get face region info
            face_info = {
                "facial_area": embedding_obj.get("facial_area", {}),
                "face_confidence": embedding_obj.get("face_confidence", 1.0),
            }

            logger.info(
                f"Successfully extracted face embedding with {len(embedding)} dimensions"
            )
            return embedding, face_info

        except ValueError as e:
            # Re-raise ValueError (includes our user-friendly message)
            logger.warning(f"Face detection error: {e}")
            raise
        except Exception as e:
            error_msg = str(e)
            # Check if it's a numpy array or face detection error
            if "numpy array" in error_msg.lower() or "face" in error_msg.lower():
                logger.warning(f"Face detection failed: {e}")
                raise ValueError("Could not detect your face, please try again")
            else:
                logger.error(f"Error extracting face embedding: {e}")
                raise ValueError("Could not detect a face, try again please")

    async def register_face(self, user_id: int, image_data: str) -> bool:
        """
        Register a user's face by storing their embedding.
        Prevents duplicate face registrations (same face for multiple users).

        Args:
            user_id: User ID from users table
            image_data: Base64 encoded image string

        Returns:
            True if registration successful

        Raises:
            ValueError: If the face is already registered to a different user
        """
        try:
            # Extract face embedding
            embedding, face_info = self.extract_face_embedding(image_data)

            # Check if this face already exists for a DIFFERENT user
            duplicate_user = await self._find_existing_face(embedding, user_id)
            if duplicate_user is not None:
                error_msg = (
                    f"This face is already registered to another account. "
                    f"Please login to your existing account instead of creating a new one."
                )
                logger.warning(
                    f"Attempted duplicate face registration for user {user_id}, "
                    f"face already belongs to user {duplicate_user}"
                )
                raise ValueError(error_msg)

            # Serialize embedding to binary
            embedding_binary = pickle.dumps(embedding)

            # Store in database
            async with get_db() as conn:
                async with conn.cursor() as cursor:
                    # Check if user already has a face registered
                    await cursor.execute(
                        "SELECT id FROM face_embeddings WHERE user_id = %s", (user_id,)
                    )
                    existing = await cursor.fetchone()

                    if existing:
                        # Update existing embedding
                        await cursor.execute(
                            """UPDATE face_embeddings 
                               SET embedding = %s, model_name = %s, updated_at = CURRENT_TIMESTAMP
                               WHERE user_id = %s""",
                            (embedding_binary, self.model, user_id),
                        )
                        logger.info(f"Updated face embedding for user {user_id}")
                    else:
                        # Insert new embedding
                        await cursor.execute(
                            """INSERT INTO face_embeddings (user_id, embedding, model_name)
                               VALUES (%s, %s, %s)""",
                            (user_id, embedding_binary, self.model),
                        )
                        logger.info(f"Registered new face embedding for user {user_id}")

                    await conn.commit()

            return True

        except Exception as e:
            logger.error(f"Error registering face for user {user_id}: {e}")
            raise

    async def _find_existing_face(
        self, new_embedding: np.ndarray, current_user_id: int
    ) -> Optional[int]:
        """
        Check if a face already exists in the database for a different user

        Args:
            new_embedding: The face embedding to check
            current_user_id: The user ID registering the face (to exclude)

        Returns:
            User ID if face found for different user, None otherwise
        """
        try:
            # Get all stored embeddings
            async with get_db() as conn:
                async with conn.cursor() as cursor:
                    await cursor.execute(
                        "SELECT user_id, embedding FROM face_embeddings WHERE user_id != %s",
                        (current_user_id,),
                    )
                    results = await cursor.fetchall()

            if not results:
                return None

            # Compare against all OTHER stored embeddings
            for row in results:
                user_id = row["user_id"]
                stored_embedding = pickle.loads(row["embedding"])

                distance = self._calculate_distance(new_embedding, stored_embedding)

                # If match found within threshold, this face already exists
                if distance <= VERIFICATION_THRESHOLD:
                    logger.warning(
                        f"Duplicate face detected: user {user_id} already has this face "
                        f"(distance: {distance:.4f})"
                    )
                    return user_id

            return None

        except Exception as e:
            logger.error(f"Error checking for duplicate faces: {e}")
            # Don't raise here - let registration continue
            # If duplicate check fails, let the system continue rather than blocking
            return None

    async def verify_face(self, user_id: int, image_data: str) -> Tuple[bool, float]:
        """
        Verify if the provided image matches the registered face for a user

        Args:
            user_id: User ID to verify against
            image_data: Base64 encoded image string

        Returns:
            Tuple of (is_match, similarity_score)
        """
        try:
            # Extract embedding from provided image
            current_embedding, _ = self.extract_face_embedding(image_data)

            # Get stored embedding from database
            async with get_db() as conn:
                async with conn.cursor() as cursor:
                    await cursor.execute(
                        "SELECT embedding, model_name FROM face_embeddings WHERE user_id = %s",
                        (user_id,),
                    )
                    result = await cursor.fetchone()

            if not result:
                logger.warning(f"No face embedding found for user {user_id}")
                return False, 1.0  # Return max distance (no match)

            # Deserialize stored embedding
            stored_embedding = pickle.loads(result["embedding"])

            # Calculate distance between embeddings
            distance = self._calculate_distance(current_embedding, stored_embedding)

            # Determine if faces match
            is_match = distance <= VERIFICATION_THRESHOLD

            logger.info(
                f"Face verification for user {user_id}: {'Match' if is_match else 'No match'} (distance: {distance:.4f})"
            )

            return is_match, distance

        except Exception as e:
            logger.error(f"Error verifying face for user {user_id}: {e}")
            raise

    async def find_matching_user(self, image_data: str) -> Optional[int]:
        """
        Find a user by comparing face against all registered faces

        Args:
            image_data: Base64 encoded image string

        Returns:
            User ID if match found, None otherwise
        """
        try:
            # Extract embedding from provided image
            current_embedding, _ = self.extract_face_embedding(image_data)
            print(f"🎯 [find_matching_user] Extracted embedding from image")

            # Get all stored embeddings
            async with get_db() as conn:
                async with conn.cursor() as cursor:
                    await cursor.execute(
                        "SELECT user_id, embedding FROM face_embeddings"
                    )
                    results = await cursor.fetchall()

            print(
                f"🎯 [find_matching_user] Found {len(results)} stored face embeddings in DB"
            )
            if not results:
                logger.info("No face embeddings in database")
                return None

            # Compare against all stored embeddings
            best_match_user = None
            best_match_distance = float("inf")

            for row in results:
                user_id = row["user_id"]
                stored_embedding = pickle.loads(row["embedding"])

                distance = self._calculate_distance(current_embedding, stored_embedding)
                print(f"   → user_id={user_id}: distance={distance:.4f}")

                if distance < best_match_distance:
                    best_match_distance = distance
                    best_match_user = user_id

            # Check if best match is within threshold
            if best_match_distance <= VERIFICATION_THRESHOLD:
                print(
                    f"✅ [find_matching_user] MATCH FOUND: user_id={best_match_user}, distance={best_match_distance:.4f}"
                )
                logger.info(
                    f"Found matching user {best_match_user} with distance {best_match_distance:.4f}"
                )
                return best_match_user
            else:
                print(
                    f"❌ [find_matching_user] NO MATCH: Best distance {best_match_distance:.4f} exceeds threshold {VERIFICATION_THRESHOLD}"
                )
                logger.info(
                    f"No matching user found. Best distance: {best_match_distance:.4f}"
                )
                return None

        except Exception as e:
            logger.error(f"Error finding matching user: {e}")
            print(f"❌ [find_matching_user] Error: {e}")
            raise

    def _calculate_distance(
        self, embedding1: np.ndarray, embedding2: np.ndarray
    ) -> float:
        """
        Calculate distance between two face embeddings

        Args:
            embedding1: First embedding vector
            embedding2: Second embedding vector

        Returns:
            Distance value (lower = more similar)
        """
        if self.distance_metric == "cosine":
            # Cosine distance
            return 1 - np.dot(embedding1, embedding2) / (
                np.linalg.norm(embedding1) * np.linalg.norm(embedding2)
            )
        elif self.distance_metric == "euclidean":
            # Euclidean distance
            return np.linalg.norm(embedding1 - embedding2)
        elif self.distance_metric == "euclidean_l2":
            # Normalized euclidean distance
            return np.linalg.norm(
                embedding1 / np.linalg.norm(embedding1)
                - embedding2 / np.linalg.norm(embedding2)
            )
        else:
            raise ValueError(f"Unknown distance metric: {self.distance_metric}")

    async def delete_face_embedding(self, user_id: int) -> bool:
        """
        Delete face embedding for a user

        Args:
            user_id: User ID

        Returns:
            True if deleted successfully
        """
        try:
            async with get_db() as conn:
                async with conn.cursor() as cursor:
                    await cursor.execute(
                        "DELETE FROM face_embeddings WHERE user_id = %s", (user_id,)
                    )
                    deleted = cursor.rowcount > 0
                await conn.commit()

            if deleted:
                logger.info(f"Deleted face embedding for user {user_id}")

            return deleted

        except Exception as e:
            logger.error(f"Error deleting face embedding for user {user_id}: {e}")
            raise


# Singleton instance
face_recognition_service = FaceRecognitionService()


# Convenience functions for easier imports
async def register_face(user_id: int, image_data: str) -> bool:
    """Register a user's face"""
    return await face_recognition_service.register_face(user_id, image_data)


async def verify_face(user_id: int, image_data: str) -> Tuple[bool, float]:
    """Verify a user's face"""
    return await face_recognition_service.verify_face(user_id, image_data)


async def find_matching_user(image_data: str) -> Optional[int]:
    """Find a user by face"""
    return await face_recognition_service.find_matching_user(image_data)


async def delete_face_embedding(user_id: int) -> bool:
    """Delete a user's face embedding"""
    return await face_recognition_service.delete_face_embedding(user_id)
