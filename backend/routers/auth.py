import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from models.database import get_db
from models.models import User
from models.schemas import UserCreate, Token
from services.auth_service import get_password_hash, verify_password, create_access_token, create_refresh_token, verify_token, verify_refresh_token
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from datetime import timedelta

router = APIRouter()
logger = logging.getLogger(__name__)

# OAuth2 密码流机制
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


# 用户注册
@router.post("/register", response_model=Token)
def register_user(user_data: UserCreate, db: Session = Depends(get_db)):
    # 检查用户是否已经存在
    user = db.query(User).filter(User.email == user_data.email).first()
    if user:
        raise HTTPException(status_code=400, detail="Email is already registered")

    # 哈希密码并保存用户
    hashed_password = get_password_hash(user_data.password)
    new_user = User(email=user_data.email, password=hashed_password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # 注册后生成 Access Token 和 Refresh Token
    access_token_expires = timedelta(minutes=30)
    access_token = create_access_token(data={"sub": str(new_user.user_id)}, expires_delta=access_token_expires)
    refresh_token = create_refresh_token(data={"sub": str(new_user.user_id)})

    logger.info("register success user_id=%s", new_user.user_id)
    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}


# 用户登录
@router.post("/login", response_model=Token)
def login_user(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 登录成功后生成 Access Token 和 Refresh Token
    access_token_expires = timedelta(minutes=30)
    access_token = create_access_token(data={"sub": str(user.user_id)}, expires_delta=access_token_expires)
    refresh_token = create_refresh_token(data={"sub": str(user.user_id)})

    logger.info("login success user_id=%s", user.user_id)
    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}


# 刷新 Access Token
@router.post("/refresh")
def refresh_access_token(refresh_token: str, db: Session = Depends(get_db)):
    # 验证 refresh token
    user_id = verify_refresh_token(refresh_token)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 确保 user_id 是整数类型
    try:
        user_id = int(user_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=401, detail="Invalid token format")

    # 验证用户是否存在
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # 生成新的 access token
    access_token_expires = timedelta(minutes=30)
    access_token = create_access_token(data={"sub": str(user.user_id)}, expires_delta=access_token_expires)

    return {"access_token": access_token, "token_type": "bearer"}


# JWT保护路由示例
@router.get("/users/me")
def read_users_me(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    user_id = verify_token(token)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return user
