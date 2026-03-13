from supabase import create_client, Client
from app.config import SUPABASE_URL, SUPABASE_KEY

def get_supabase_client() -> Client:
    """Get Supabase client instance."""
    return create_client(SUPABASE_URL, SUPABASE_KEY)

# Singleton instance
supabase = get_supabase_client()