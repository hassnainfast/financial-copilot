import asyncio
import os
from typing import Optional
import edge_tts
from app.config import AUDIO_LANGUAGE, AUDIO_DIR

class TTSService:
    """Text-to-Speech service using Edge-TTS for natural Urdu voice."""
    
    # Urdu voices available in Edge-TTS
    URDU_VOICES = {
        "male": "ur-PK-AsadNeural",
        "female": "ur-PK-UzmaNeural"
    }
    
    def __init__(self):
        os.makedirs(AUDIO_DIR, exist_ok=True)
    
    async def generate_audio(self, text: str, filename: str, voice: str = "male") -> Optional[str]:
        """
        Generate Urdu audio from text.
        
        Args:
            text: Urdu text to convert
            filename: Output filename (without path)
            voice: "male" or "female"
        
        Returns:
            Relative path to audio file or None if failed
        """
        try:
            voice_name = self.URDU_VOICES.get(voice, self.URDU_VOICES["male"])
            filepath = os.path.join(AUDIO_DIR, filename)
            
            communicate = edge_tts.Communicate(text, voice_name)
            await communicate.save(filepath)
            
            return filepath.replace("\\", "/")
        
        except Exception as e:
            print(f"❌ TTS Error: {e}")
            return None
    
    async def generate_confirmation_audio(self, message: str, filename: str = "confirm.mp3") -> Optional[str]:
        """Generate confirmation audio in Urdu."""
        # For now, use the message directly (should be in Urdu)
        # Later, we can add translation layer
        return await self.generate_audio(message, filename)