"""
Face Authentication Routes (FastAPI)
Handles face registration and login endpoints
"""

from fastapi import APIRouter, HTTPException, Depends, Header, Cookie
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
async def face_login_endpoint(request: FaceImageRequest):
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

                await cursor.execute(
                    """INSERT INTO auth_sessions (auth_session_id, user_id, expires_at)
                       VALUES (%s, %s, %s)""",
                    (auth_session_id, user_id, expires_at),
                )

            await conn.commit()

        logger.info(f"Face login successful for user {user_id}")

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
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Face login error: {e}")
        raise HTTPException(status_code=500, detail="Login failed")


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
