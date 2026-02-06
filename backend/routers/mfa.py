from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session
from models.database import get_db
from models.models import User
from models.schemas import Token
from services.auth_service import verify_token, verify_totp, create_access_token, create_refresh_token, get_totp_uri, generate_totp_secret
from datetime import timedelta
import base64
import qrcode
from io import BytesIO

router = APIRouter()

# Temporary token verification for MFA setting/login process
def verify_mfa_temp_token(token: str):
    # In a real implementation, you might want a distinct scope or secret for temp tokens.
    # Here, we reuse the general verify_token logic but we expect the payload to indicate state.
    # For simplicity in this iteration, we just verify the user ID.
    return verify_token(token)

@router.post("/setup/init")
def mfa_setup_init(temp_token: str = Body(..., embed=True), db: Session = Depends(get_db)):
    """
    Initialize MFA setup. Returns a secret and a QR code (base64 image).
    User must be authenticated via a temporary token (pre-MFA).
    """
    user_id = verify_mfa_temp_token(temp_token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Generate new secret
    secret = generate_totp_secret()
    
    # Generate QR Code
    uri = get_totp_uri(secret, user.email)
    img = qrcode.make(uri)
    buffered = BytesIO()
    img.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode()
    
    return {
        "secret": secret,
        "qr_code": f"data:image/png;base64,{img_str}"
    }

@router.post("/setup/verify", response_model=Token)
def mfa_setup_verify(
    temp_token: str = Body(...),
    secret: str = Body(...),
    code: str = Body(...),
    db: Session = Depends(get_db)
):
    """
    Verify the code against the provided secret. If valid, save secret to user and enable MFA.
    Returns standard access/refresh tokens.
    """
    user_id = verify_mfa_temp_token(temp_token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid session")

    if not verify_totp(secret, code):
        raise HTTPException(status_code=400, detail="Invalid OTP code")

    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Validated. Save secret and clean up.
    user.totp_secret = secret
    user.is_totp_enabled = True # Force enable if not already
    db.commit()

    # Issue real tokens
    access_token_expires = timedelta(minutes=30)
    access_token = create_access_token(data={"sub": str(user.user_id)}, expires_delta=access_token_expires)
    refresh_token = create_refresh_token(data={"sub": str(user.user_id)})

    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}

@router.post("/verify", response_model=Token)
def mfa_verify(
    temp_token: str = Body(...),
    code: str = Body(...),
    db: Session = Depends(get_db)
):
    """
    Verify MFA code for login. User's secret must already be in DB.
    """
    user_id = verify_mfa_temp_token(temp_token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid session")

    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not user.totp_secret:
         raise HTTPException(status_code=400, detail="MFA not setup for this user")

    if not verify_totp(user.totp_secret, code):
        raise HTTPException(status_code=400, detail="Invalid OTP code")

    # Issue real tokens
    access_token_expires = timedelta(minutes=30)
    access_token = create_access_token(data={"sub": str(user.user_id)}, expires_delta=access_token_expires)
    refresh_token = create_refresh_token(data={"sub": str(user.user_id)})

    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}
