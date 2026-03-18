"""Auth router: register, login, Google OAuth2 callback."""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models.models import User
from app.schemas.schemas import Token, UserCreate, UserRead
from app.services.classroom_service import exchange_code_for_tokens, get_google_auth_url

router = APIRouter()


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def register(payload: UserCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == payload.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    await db.flush()
    return user


@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == form_data.username))
    user: User | None = result.scalar_one_or_none()
    if not user or not verify_password(form_data.password, user.hashed_password or ""):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token({"sub": str(user.id)})
    return Token(access_token=token)


@router.get("/google")
async def google_auth():
    """Redirect the user to Google's OAuth2 consent screen."""
    url = get_google_auth_url()
    return {"auth_url": url}


@router.get("/google/callback")
async def google_callback(code: str, db: AsyncSession = Depends(get_db)):
    """Exchange the authorization code for tokens and store them."""
    tokens = exchange_code_for_tokens(code)
    # In production: look up user by Google sub-claim and update tokens
    return {"message": "Google tokens received", "access_token": tokens["access_token"]}
