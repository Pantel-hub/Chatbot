"""
Face Authentication Routes (FastAPI)
Handles face registration and login endpoints
"""

from fastapi import APIRouter, HTTPException, Depends, Header, Cookie, Response
from pydantic import BaseModel
from typing import Optional
import logging
import uuid
from datetime import datetime, timedelta
from facerec_service import (
    register_face,
    verify_face,
    find_matching_user,
    delete_face_embedding,
)
from database_connection import get_db

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create Router
router = APIRouter(prefix="/api/face", tags=["face-auth"])


# Pydantic Models
class FaceImageRequest(BaseModel):
    image: str  # Base64 encoded image
    language: str = "el"  # Default to Greek, accepts "en" for English


# Helper function for bilingual face detection error messages
def get_face_error_message(error: str, language: str) -> str:
    """Translate face detection errors to the appropriate language"""
    error_lower = error.lower()
    
    # Check for common face detection errors
    if "numpy array" in error_lower or "could not detect" in error_lower or "face" in error_lower:
        if language == "en":
            return "Could not detect any face, please try again."
        else:
            return "Δεν αναγνωρίστηκε κάποιο πρόσωπο, προσπαθήστε ξανά."
    
    if "not recognized" in error_lower or "no matching" in error_lower:
        if language == "en":
            return "Face not recognized. Please try again or use another login method."
        else:
            return "Το πρόσωπο δεν αναγνωρίστηκε. Δοκιμάστε ξανά ή χρησιμοποιήστε άλλη μέθοδο σύνδεσης."
    
    # Default: return original error
    return error


class FaceLoginResponse(BaseModel):
    success: bool
    user_id: Optional[int] = None
    auth_session_id: Optional[str] = None
    user: Optional[dict] = None


class FaceVerifyResponse(BaseModel):
    success: bool
    match: bool
    confidence: float
    distance: float


class FaceStatusResponse(BaseModel):
    success: bool
    has_face: bool
    registered_at: Optional[str] = None
    updated_at: Optional[str] = None
    model: Optional[str] = None


# Authentication dependency
async def get_current_user(
    authorization: Optional[str] = Header(None),
    auth_session_id: Optional[str] = Cookie(None),
) -> int:
    """Get current authenticated user ID"""
    session_id = authorization or auth_session_id

    if not session_id:
        raise HTTPException(status_code=401, detail="Unauthorized")

    try:
        async with get_db() as conn:
            async with conn.cursor() as cursor:
                await cursor.execute(
                    """SELECT user_id FROM auth_sessions 
                       WHERE auth_session_id = %s AND expires_at > NOW()""",
                    (session_id,),
                )
                session = await cursor.fetchone()

        if not session:
            raise HTTPException(status_code=401, detail="Invalid or expired session")

        return session["user_id"]

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Session verification error: {e}")
        raise HTTPException(status_code=500, detail="Authentication error")


@router.post("/register")
async def register_face_endpoint(
    request: FaceImageRequest, user_id: int = Depends(get_current_user)
):
    """
    Register or update face for authenticated user

    Request Body:
    {
        "image": "base64_encoded_image_string"
    }
    """
    try:
        # Register the face
        await register_face(user_id, request.image)

        logger.info(f"Face registered successfully for user {user_id}")

        return {"success": True, "message": "Face registered successfully"}

    except ValueError as e:
        logger.warning(f"Face registration validation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Face registration error: {e}")
        raise HTTPException(status_code=500, detail="Failed to register face")


@router.post("/login", response_model=FaceLoginResponse)
async def face_login_endpoint(response: Response, request: FaceImageRequest):
    """
    Login using face recognition

    Request Body:
    {
        "image": "base64_encoded_image_string"
    }
    """
    try:
        # Find matching user
        user_id = await find_matching_user(request.image)
        print(f"🔍 [Face Login] Face matched to user_id: {user_id}")
        logger.info(f"🔍 [Face Login] Face matched to user_id: {user_id}")

        if not user_id:
            logger.warning("Face login failed: No matching user found")
            raise HTTPException(status_code=401, detail="Face not recognized")

        # Get user details and create session
        async with get_db() as conn:
            async with conn.cursor() as cursor:
                await cursor.execute(
                    """SELECT id, email, first_name, last_name, phone_number 
                       FROM users WHERE id = %s""",
                    (user_id,),
                )
                user = await cursor.fetchone()
                print(f"👤 [Face Login] User data from DB: {dict(user) if user else 'NOT FOUND'}")
                logger.info(f"👤 [Face Login] User data from DB: {dict(user) if user else 'NOT FOUND'}")

                if not user:
                    raise HTTPException(status_code=404, detail="User not found")

                # Update last login
                await cursor.execute(
                    "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = %s",
                    (user_id,),
                )

                # Create authentication session
                auth_session_id = str(uuid.uuid4())
                expires_at = datetime.now() + timedelta(days=30)
                print(f"🔐 [Face Login] Creating session: auth_session_id={auth_session_id}, user_id={user_id}, expires_at={expires_at}")
                logger.info(f"🔐 [Face Login] Creating session: auth_session_id={auth_session_id}, user_id={user_id}, expires_at={expires_at}")

                await cursor.execute(
                    """INSERT INTO auth_sessions (auth_session_id, user_id, expires_at)
                       VALUES (%s, %s, %s)""",
                    (auth_session_id, user_id, expires_at),
                )

            await conn.commit()
            # Verify session was created
            async with conn.cursor() as cursor:
                await cursor.execute(
                    "SELECT * FROM auth_sessions WHERE auth_session_id = %s",
                    (auth_session_id,)
                )
                session_check = await cursor.fetchone()
                print(f"✅ [Face Login] Session verified in DB: {dict(session_check) if session_check else 'NOT FOUND'}")
                logger.info(f"✅ [Face Login] Session verified in DB: {dict(session_check) if session_check else 'NOT FOUND'}")

        # Set cookie for session
        response.set_cookie(
            key="auth_session_id",
            value=auth_session_id,
            httponly=True,
            secure=False,
            samesite="lax",
            max_age=2592000,  # 30 days
            path="/",
        )
        print(f"🍪 [Face Login] Cookie set: auth_session_id={auth_session_id}")
        logger.info(f"🍪 [Face Login] Cookie set: auth_session_id={auth_session_id}")
        logger.info(f"✨ Face login successful for user {user_id}")

        return {
            "success": True,
            "user_id": user_id,
            "auth_session_id": auth_session_id,
            "user": {
                "email": user["email"],
                "first_name": user["first_name"],
                "last_name": user["last_name"],
                "phone_number": user["phone_number"],
            },
        }

    except HTTPException:
        raise
    except ValueError as e:
        logger.warning(f"Face login validation error: {e}")
        error_msg = get_face_error_message(str(e), request.language)
        raise HTTPException(status_code=400, detail=error_msg)
    except Exception as e:
        logger.error(f"Face login error: {e}")
        error_msg = get_face_error_message(str(e), request.language)
        raise HTTPException(status_code=500, detail=error_msg)


@router.post("/verify", response_model=FaceVerifyResponse)
async def verify_face_endpoint(
    request: FaceImageRequest, user_id: int = Depends(get_current_user)
):
    """
    Verify face matches the authenticated user's registered face

    Request Body:
    {
        "image": "base64_encoded_image_string"
    }
    """
    try:
        # Verify face
        is_match, distance = verify_face(user_id, request.image)

        # Convert distance to confidence score (0-1, higher is better)
        confidence = max(0, 1 - distance)

        logger.info(
            f"Face verification for user {user_id}: {'Match' if is_match else 'No match'}"
        )

        return {
            "success": True,
            "match": is_match,
            "confidence": round(confidence, 4),
            "distance": round(distance, 4),
        }

    except ValueError as e:
        logger.warning(f"Face verification validation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Face verification error: {e}")
        raise HTTPException(status_code=500, detail="Verification failed")


@router.delete("/delete")
async def delete_face_endpoint(user_id: int = Depends(get_current_user)):
    """Delete face embedding for authenticated user"""
    try:
        # Delete face embedding
        deleted = delete_face_embedding(user_id)

        if not deleted:
            raise HTTPException(
                status_code=404, detail="No face data found for this user"
            )

        logger.info(f"Face data deleted for user {user_id}")

        return {"success": True, "message": "Face data deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Face deletion error: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete face data")


@router.get("/status", response_model=FaceStatusResponse)
async def face_status_endpoint(user_id: int = Depends(get_current_user)):
    """Check if user has face registered"""
    try:
        async with get_db() as conn:
            async with conn.cursor() as cursor:
                await cursor.execute(
                    """SELECT created_at, updated_at, model_name 
                       FROM face_embeddings WHERE user_id = %s""",
                    (user_id,),
                )
                result = await cursor.fetchone()

        if result:
            return {
                "success": True,
                "has_face": True,
                "registered_at": (
                    result["created_at"].isoformat() if result["created_at"] else None
                ),
                "updated_at": (
                    result["updated_at"].isoformat() if result["updated_at"] else None
                ),
                "model": result["model_name"],
            }
        else:
            return {"success": True, "has_face": False}

    except Exception as e:
        logger.error(f"Face status check error: {e}")
        raise HTTPException(status_code=500, detail="Failed to check face status")


class FaceExistsResponse(BaseModel):
    exists: bool
    message: str


@router.post("/check-exists", response_model=FaceExistsResponse)
async def check_face_exists_endpoint(request: FaceImageRequest):
    """
    Check if a face is already registered in the system.
    This endpoint does NOT require authentication - it's used during registration
    to prevent duplicate face registrations BEFORE creating an account.

    Request Body:
    {
        "image": "base64_encoded_image_string"
    }

    Returns:
    {
        "exists": true/false,
        "message": "Human readable message"
    }
    """
    try:
        # Use find_matching_user to check if this face already exists
        existing_user_id = await find_matching_user(request.image)

        if existing_user_id is not None:
            logger.warning(f"Face already exists for user_id: {existing_user_id}")
            return {
                "exists": True,
                "message": "This face is already registered to another account. Please login to your existing account instead of creating a new one.",
            }

        return {
            "exists": False,
            "message": "Face is not registered yet.",
        }

    except ValueError as e:
        # Face detection failed (no face found, etc.)
        logger.warning(f"Face detection error during check: {e}")
        error_msg = get_face_error_message(str(e), request.language)
        raise HTTPException(status_code=400, detail=error_msg)
    except Exception as e:
        logger.error(f"Face existence check error: {e}")
        error_msg = get_face_error_message(str(e), request.language)
        raise HTTPException(status_code=500, detail=error_msg)
