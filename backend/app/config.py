import os
from dotenv import load_dotenv

load_dotenv()

# Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# LLM API Keys
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Model Configuration
GROQ_MODEL = "llama-3.1-8b-instant"  # Fast text processing
GEMINI_MODEL = "gemini-2.5-flash"  # Vision/complex tasks

# Audio Configuration
AUDIO_LANGUAGE = "ur-PK"  # Urdu Pakistan
AUDIO_DIR = "static/audio"
UPLOAD_DIR = "uploads"

# Workflow Configuration
WORKFLOW_TTL_SECONDS = 1800  # 30 minutes session expiry

# Validate required env vars
REQUIRED_VARS = ["SUPABASE_URL", "SUPABASE_KEY", "GROQ_API_KEY", "GEMINI_API_KEY"]
missing = [var for var in REQUIRED_VARS if not os.getenv(var)]
if missing:
    raise ValueError(f"Missing environment variables: {missing}")